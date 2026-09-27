import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { CommunicationPreferencesWorkspace } from './CommunicationPreferencesWorkspace'
import {
  getCommunicationPreferences,
  putCommunicationPreference,
  type CommunicationPreference,
} from './communicationPreferencesApi'

vi.mock('./communicationPreferencesApi', () => ({
  getCommunicationPreferences: vi.fn(),
  putCommunicationPreference: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('explains mandatory security notices and saves supported email and digest choices', async () => {
  const initial: CommunicationPreference[] = [
    {
      category: 'accountSecurity',
      inAppEnabled: true,
      emailEnabled: false,
      digestCadence: 'off',
    },
    {
      category: 'schoolAnnouncements',
      inAppEnabled: true,
      emailEnabled: false,
      digestCadence: 'off',
    },
  ]
  vi.mocked(getCommunicationPreferences).mockResolvedValue(initial)
  vi.mocked(putCommunicationPreference).mockImplementation(
    async (_baseUrl, value) =>
      initial.map((item) => (item.category === value.category ? value : item)),
  )
  render(<CommunicationPreferencesWorkspace baseUrl="/api" />)
  await screen.findByText('Always on')
  expect(
    screen.queryByRole('checkbox', { name: 'Account security in-app' }),
  ).toBeNull()
  expect(
    (
      screen.getByRole('combobox', {
        name: 'School announcements digest',
      }) as HTMLSelectElement
    ).disabled,
  ).toBe(true)
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'School announcements email' }),
  )
  await waitFor(() =>
    expect(putCommunicationPreference).toHaveBeenCalledWith(
      '/api',
      expect.objectContaining({
        category: 'schoolAnnouncements',
        emailEnabled: true,
      }),
    ),
  )
  await waitFor(() =>
    expect(
      (
        screen.getByRole('combobox', {
          name: 'School announcements digest',
        }) as HTMLSelectElement
      ).disabled,
    ).toBe(false),
  )
  fireEvent.change(
    screen.getByRole('combobox', { name: 'School announcements digest' }),
    { target: { value: 'daily' } },
  )
  await waitFor(() =>
    expect(putCommunicationPreference).toHaveBeenLastCalledWith(
      '/api',
      expect.objectContaining({ digestCadence: 'daily' }),
    ),
  )
  expect(screen.queryByText(/internal notification type/i)).toBeNull()
})
