import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { AccountSecurity, AdminRecovery } from './AccountSecurity'
import { PublicRecovery } from './PublicRecovery'
import { changePassword } from './api'
import {
  assistRecovery,
  getOwnSessions,
  requestRecovery,
  resetRecovery,
  revokeOtherSessions,
  revokeOwnSession,
} from './securityApi'

vi.mock('./api', () => ({ changePassword: vi.fn() }))
vi.mock('./securityApi', () => ({
  assistRecovery: vi.fn(),
  getOwnSessions: vi.fn(),
  requestRecovery: vi.fn(),
  resetRecovery: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeOwnSession: vi.fn(),
}))
afterEach(cleanup)

describe('account security workspace', () => {
  it('shows safe sessions and revokes another session', async () => {
    vi.mocked(getOwnSessions).mockResolvedValue([
      {
        managementId: '123e4567-e89b-42d3-a456-426614174001',
        createdAt: '2026-09-26T00:00:00.000Z',
        expiresAt: '2026-09-27T00:00:00.000Z',
        current: false,
      },
    ])
    vi.mocked(revokeOwnSession).mockResolvedValue()
    vi.mocked(revokeOtherSessions).mockResolvedValue()
    vi.mocked(changePassword).mockResolvedValue()
    render(<AccountSecurity baseUrl="/api" />)
    fireEvent.click(screen.getByRole('button', { name: 'Account security' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Revoke session' }),
    )
    await waitFor(() => expect(revokeOwnSession).toHaveBeenCalled())
    expect(screen.queryByText(/tokenHash/)).toBeNull()
  })
  it('keeps recovery requests neutral and exposes assistance only when mounted for an admin', async () => {
    vi.mocked(requestRecovery).mockResolvedValue()
    vi.mocked(resetRecovery).mockResolvedValue()
    vi.mocked(assistRecovery).mockResolvedValue()
    const { rerender } = render(<PublicRecovery baseUrl="/api" />)
    fireEvent.change(screen.getByLabelText('Recovery email'), {
      target: { value: 'any@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request recovery' }))
    expect(
      await screen.findByText(
        'If the account exists, recovery instructions will be sent.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('Assist account recovery')).toBeNull()
    rerender(
      <AdminRecovery
        baseUrl="/api"
        schoolId="123e4567-e89b-42d3-a456-426614174002"
      />,
    )
    expect(screen.getByText('Assist account recovery')).toBeTruthy()
  })
})
