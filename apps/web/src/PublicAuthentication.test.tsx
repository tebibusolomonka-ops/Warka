import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { PublicAuthentication, publicAuthRoute } from './PublicAuthentication'
import { requestRecovery, resetRecovery } from './securityApi'

vi.mock('./securityApi', () => ({
  requestRecovery: vi.fn(),
  resetRecovery: vi.fn(),
}))

beforeEach(() => {
  window.history.replaceState({}, '', '/login')
  vi.clearAllMocks()
})

afterEach(cleanup)

function renderAuthentication(onAuthenticate = vi.fn(async () => undefined)) {
  render(
    <PublicAuthentication
      baseUrl="https://api.example.test"
      onAuthenticate={onAuthenticate}
    />,
  )
  return onAuthenticate
}

describe('public authentication routing', () => {
  it.each([
    ['/', 'login'],
    ['/login', 'login'],
    ['/login/', 'login'],
    ['/forgot-password', 'forgot-password'],
    ['/reset-password', 'reset-password'],
    ['/unknown', 'not-found'],
  ] as const)('maps %s to %s', (path, route) => {
    expect(publicAuthRoute(path)).toBe(route)
  })

  it('navigates between login and recovery without exposing reset controls', () => {
    renderAuthentication()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(screen.queryByLabelText('Recovery token')).toBeNull()
    expect(screen.queryByLabelText('New password')).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'Forgot your password?' }))

    expect(
      screen.getByRole('heading', { name: 'Recover your account' }),
    ).toBeTruthy()
    expect(window.location.pathname).toBe('/forgot-password')
  })
})

describe('sign in', () => {
  it('uses password-manager semantics and submits validated credentials', async () => {
    const authenticate = renderAuthentication()
    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')

    expect(email).toHaveProperty('name', 'loginEmail')
    expect(email).toHaveProperty('autocomplete', 'username')
    expect(password).toHaveProperty('name', 'loginPassword')
    expect(password).toHaveProperty('autocomplete', 'current-password')

    fireEvent.change(email, { target: { value: 'owner@example.test' } })
    fireEvent.change(password, { target: { value: 'valid-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(authenticate).toHaveBeenCalledWith(
        'owner@example.test',
        'valid-password',
      ),
    )
  })

  it('reveals and conceals the password without submitting the form', () => {
    renderAuthentication()
    const password = screen.getByLabelText('Password')
    expect(password).toHaveProperty('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveProperty('type', 'text')
    expect(
      screen
        .getByRole('button', { name: 'Hide password' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
})

describe('account recovery', () => {
  it('returns the same neutral outcome after a recovery request', async () => {
    window.history.replaceState({}, '', '/forgot-password')
    vi.mocked(requestRecovery).mockResolvedValue()
    renderAuthentication()

    const email = screen.getByLabelText('Recovery email')
    expect(email).toHaveProperty('autocomplete', 'email')
    fireEvent.change(email, { target: { value: 'anyone@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request recovery' }))

    expect(
      await screen.findByText(
        'If the account exists, recovery instructions will be sent.',
      ),
    ).toBeTruthy()
    expect(requestRecovery).toHaveBeenCalledWith(
      'https://api.example.test',
      'anyone@example.test',
    )
  })

  it('requires a recovery link token before showing password fields', () => {
    window.history.replaceState({}, '', '/reset-password')
    renderAuthentication()

    expect(screen.getByText('Recovery link required')).toBeTruthy()
    expect(screen.queryByLabelText('New password')).toBeNull()
  })

  it('accepts existing recovery links from the application root', () => {
    window.history.replaceState({}, '', '/?recoveryToken=legacy-link-token')
    renderAuthentication()

    expect(screen.getByLabelText('New password')).toBeTruthy()
    expect(window.location.pathname).toBe('/reset-password')
    expect(window.location.search).toBe('')
  })

  it('removes the token from the address and resets a matching password', async () => {
    window.history.replaceState(
      {},
      '',
      '/reset-password?recoveryToken=secret-token',
    )
    vi.mocked(resetRecovery).mockResolvedValue()
    renderAuthentication()

    expect(window.location.search).toBe('')
    const password = screen.getByLabelText('New password')
    const confirmation = screen.getByLabelText('Confirm new password')
    expect(password).toHaveProperty('autocomplete', 'new-password')
    expect(confirmation).toHaveProperty('autocomplete', 'new-password')

    fireEvent.change(password, { target: { value: 'long-demo-password' } })
    fireEvent.change(confirmation, {
      target: { value: 'long-demo-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() =>
      expect(resetRecovery).toHaveBeenCalledWith(
        'https://api.example.test',
        'secret-token',
        'long-demo-password',
      ),
    )
    expect(await screen.findByText('Password reset complete')).toBeTruthy()
  })

  it('rejects mismatched passwords before calling the API', async () => {
    window.history.replaceState(
      {},
      '',
      '/reset-password?recoveryToken=secret-token',
    )
    renderAuthentication()

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'long-demo-password' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The passwords do not match.',
    )
    expect(resetRecovery).not.toHaveBeenCalled()
  })
})
