import { describe, expect, it, vi } from 'vitest'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'

function testApp() {
  const requestRecovery = vi.fn(async (_email: string) => {})
  const resetRecovery = vi.fn(async (token: string) => token === 'valid')
  const auth: AuthService = {
    login: async () => null,
    currentUser: async () => null,
    logout: async () => {},
    requestRecovery,
    resetRecovery,
  }
  return {
    app: buildApp({ auth, production: false }),
    requestRecovery,
    resetRecovery,
  }
}

describe('account recovery routes', () => {
  it('returns the same neutral response for known and unknown email', async () => {
    const { app, requestRecovery } = testApp()
    try {
      const known = await app.inject({
        method: 'POST',
        url: '/auth/recovery/request',
        payload: { email: 'known@example.test' },
      })
      const unknown = await app.inject({
        method: 'POST',
        url: '/auth/recovery/request',
        payload: { email: 'unknown@example.test' },
      })
      expect(known.statusCode).toBe(202)
      expect(unknown.statusCode).toBe(202)
      expect(known.json()).toEqual(unknown.json())
      expect(JSON.stringify(known.json())).not.toContain('token')
      expect(requestRecovery).toHaveBeenCalledTimes(2)
    } finally {
      await app.close()
    }
  })
  it('resets only with a valid token and limits repeated attempts', async () => {
    const { app, resetRecovery } = testApp()
    try {
      const reset = (token: string) =>
        app.inject({
          method: 'POST',
          url: '/auth/recovery/reset',
          payload: { recoveryToken: token, newPassword: 'NewPassword123!' },
        })
      expect((await reset('invalid')).statusCode).toBe(400)
      expect((await reset('valid')).statusCode).toBe(204)
      expect(resetRecovery).toHaveBeenCalledWith('valid', 'NewPassword123!')
      for (let i = 0; i < 8; i++) await reset('invalid')
      expect((await reset('invalid')).statusCode).toBe(429)
    } finally {
      await app.close()
    }
  })
})
