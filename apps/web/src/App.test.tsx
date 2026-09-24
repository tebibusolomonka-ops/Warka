import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { UserIdentity } from '@warka/shared'
import { App } from './App'
import {
  ApiError,
  getCurrentUser,
  getOrganizations,
  getSchools,
  login,
  logout,
} from './api'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getOrganizations: vi.fn(),
    getSchools: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }
})

const baseUrl = 'http://localhost:3000/api'
const user = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  email: 'owner@example.com',
  displayName: 'Owner',
}
const firstOrganization = {
  organization: {
    id: '123e4567-e89b-42d3-a456-426614174002',
    name: 'North office',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  },
  role: 'owner' as const,
}
const secondOrganization = {
  organization: {
    ...firstOrganization.organization,
    id: '123e4567-e89b-42d3-a456-426614174003',
    name: 'South office',
  },
  role: 'administrator' as const,
}
const unauthenticated = new ApiError(
  'Authentication required',
  401,
  'UNAUTHENTICATED',
)

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VITE_API_URL', '/api')
  vi.mocked(getSchools).mockResolvedValue([])
  vi.mocked(logout).mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

function signIn() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: ' OWNER@example.com ' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('authenticated web shell', () => {
  it('checks the session before showing sign in', async () => {
    vi.mocked(getCurrentUser).mockReturnValue(
      new Promise<UserIdentity>(() => {}),
    )
    render(<App />)
    expect(screen.getByRole('status').textContent).toBe(
      'Checking authentication',
    )
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
  })

  it('shows sign in for an unauthenticated visitor and clears protected data on logout', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(unauthenticated)
    vi.mocked(login).mockResolvedValue(user)
    vi.mocked(getOrganizations).mockResolvedValue([firstOrganization])
    render(<App />)
    await screen.findByRole('button', { name: 'Sign in' })
    expect(screen.queryByText('School directory')).toBeNull()
    signIn()
    await screen.findByText('School directory')
    expect(login).toHaveBeenCalledWith(baseUrl, 'owner@example.com', 'secret')
    expect(screen.getByText('North office')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: 'Sign in' })
    expect(screen.queryByText('School directory')).toBeNull()
    expect(screen.queryByText('North office')).toBeNull()
    expect(logout).toHaveBeenCalledWith(baseUrl)
    expect(window.localStorage.length).toBe(0)
  })

  it('reports invalid credentials without exposing account details', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(unauthenticated)
    vi.mocked(login).mockRejectedValue(
      new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS'),
    )
    render(<App />)
    await screen.findByRole('button', { name: 'Sign in' })
    signIn()
    await screen.findByText('Invalid email or password.')
    expect(screen.queryByText('School directory')).toBeNull()
  })

  it('keeps protected data hidden if sign out cannot reach the service', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user)
    vi.mocked(getOrganizations).mockResolvedValue([firstOrganization])
    vi.mocked(logout)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    render(<App />)
    await screen.findByText('School directory')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByText('Could not confirm sign out. Please try again.')
    expect(screen.queryByText('School directory')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry sign out' }))
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('School directory')).toBeNull()
  })

  it('supports organization selection', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user)
    vi.mocked(getOrganizations).mockResolvedValue([
      firstOrganization,
      secondOrganization,
    ])
    render(<App />)
    await screen.findByLabelText('Organization')
    expect(getSchools).toHaveBeenCalledWith(
      baseUrl,
      firstOrganization.organization.id,
    )
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: secondOrganization.organization.id },
    })
    await waitFor(() =>
      expect(getSchools).toHaveBeenCalledWith(
        baseUrl,
        secondOrganization.organization.id,
      ),
    )
  })

  it('shows empty access without inventing a directory', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user)
    vi.mocked(getOrganizations).mockResolvedValue([])
    render(<App />)
    await screen.findByText('No organizations available for this account.')
    expect(screen.queryByText('School directory')).toBeNull()
  })

  it('handles network failures and expired sessions', async () => {
    vi.mocked(getCurrentUser)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(user)
    vi.mocked(getOrganizations).mockRejectedValue(unauthenticated)
    render(<App />)
    await screen.findByText('Could not reach the service. Please try again.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Your session expired. Sign in again.')
    expect(screen.queryByText('School directory')).toBeNull()
  })
})
