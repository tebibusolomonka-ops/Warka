import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { NotificationCenter } from './NotificationCenter'
import {
  getNotificationPage,
  getUnreadNotificationCount,
  readAllNotifications,
  readNotification,
} from './notificationApi'

vi.mock('./notificationApi', () => ({
  getNotificationPage: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  readNotification: vi.fn(),
  readAllNotifications: vi.fn(),
}))
const item = {
  id: '9d113102-69c3-436b-ab9b-45f65f47ed4a',
  type: 'result.published',
  title: 'Results published',
  message: 'Your academic results are available.',
  resourceType: 'resultSet',
  resourceId: '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c',
  createdAt: '2026-09-26T00:00:00.000Z',
  readAt: null,
}
beforeEach(() => {
  vi.mocked(getUnreadNotificationCount).mockResolvedValue(1)
  vi.mocked(getNotificationPage).mockResolvedValue({
    items: [item],
    nextCursor: null,
  })
  vi.mocked(readNotification).mockResolvedValue()
  vi.mocked(readAllNotifications).mockResolvedValue()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('notification center', () => {
  it('loads on demand, renders text safely, and marks a notification read', async () => {
    render(<NotificationCenter baseUrl="/api" />)
    expect(
      await screen.findByRole('button', { name: 'Notifications (1 unread)' }),
    ).toBeTruthy()
    expect(getNotificationPage).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Notifications (1 unread)' }),
    )
    expect(await screen.findByText('Results published')).toBeTruthy()
    expect(
      screen.getByText('Your academic results are available.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }))
    await waitFor(() =>
      expect(readNotification).toHaveBeenCalledWith('/api', item.id),
    )
    expect(await screen.findByText('Read')).toBeTruthy()
  })
  it('handles empty, unread filtering, and network failures', async () => {
    vi.mocked(getNotificationPage)
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(new Error('offline'))
    render(<NotificationCenter baseUrl="/api" />)
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(await screen.findByText('No notifications.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unread only' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Results published')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() =>
      expect(readAllNotifications).toHaveBeenCalledWith('/api'),
    )
  })
})
