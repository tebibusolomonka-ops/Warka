import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { EmailDeliveryWorkspace } from './EmailDeliveryWorkspace'
import { listEmailDeliveries, retryEmailDelivery } from './operationsApi'

vi.mock('./operationsApi', () => ({
  listEmailDeliveries: vi.fn(),
  retryEmailDelivery: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows masked delivery status and retries only eligible failures', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174001'
  vi.mocked(listEmailDeliveries).mockResolvedValue([
    {
      id,
      recipient: 'r***@example.test',
      templateKey: 'accountRecovery',
      status: 'failed',
      createdAt: '2026-09-27T00:00:00.000Z',
      scheduledAt: '2026-09-27T00:00:00.000Z',
      attemptCount: 1,
      failureCode: 'UNAVAILABLE',
      retryEligible: true,
    },
  ])
  vi.mocked(retryEmailDelivery).mockResolvedValue({})
  render(
    <EmailDeliveryWorkspace
      baseUrl="/api"
      provider="degraded"
      counts={{ queued: 1, sent: 4, failed: 1 }}
      retryCount={2}
    />,
  )
  await screen.findByText(/r\*\*\*@example.test/)
  expect(screen.getByText('Provider: degraded')).toBeTruthy()
  expect(screen.getByText('Retries: 2')).toBeTruthy()
  expect(screen.queryByText(/recoveryToken|SMTP_PASSWORD/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }))
  await waitFor(() =>
    expect(retryEmailDelivery).toHaveBeenCalledWith('/api', id),
  )
})
