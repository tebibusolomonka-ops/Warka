import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'

const userId = randomUUID()
const own = randomUUID()
const other = randomUUID()
const user = {
  id: userId,
  email: 'sessions@example.test',
  displayName: 'Sessions User',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies User

describe('session management routes', () => {
  it('lists only safe metadata and revokes only own sessions', async () => {
    const auth: AuthService = {
      login: async () => null,
      currentUser: async (token) => (token === 'current' ? user : null),
      logout: async () => {},
      listSessions: async (token) =>
        token === 'current'
          ? [
              {
                managementId: own,
                createdAt: new Date(),
                expiresAt: new Date(),
                current: true,
              },
            ]
          : null,
      revokeSession: async (token, id) => token === 'current' && id === own,
      revokeOthers: async (token) => token === 'current',
    }
    const app = buildApp({ auth })
    const cookie = { cookie: 'warka_session=current' }
    try {
      expect(
        (await app.inject({ method: 'GET', url: '/auth/sessions' })).statusCode,
      ).toBe(401)
      const list = await app.inject({
        method: 'GET',
        url: '/auth/sessions',
        headers: cookie,
      })
      expect(list.statusCode).toBe(200)
      expect(list.json().sessions[0].current).toBe(true)
      expect(JSON.stringify(list.json())).not.toContain('tokenHash')
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/auth/sessions/${other}`,
            headers: cookie,
          })
        ).statusCode,
      ).toBe(404)
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/auth/sessions/${own}`,
            headers: cookie,
          })
        ).statusCode,
      ).toBe(204)
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: '/auth/sessions/others',
            headers: cookie,
          })
        ).statusCode,
      ).toBe(204)
    } finally {
      await app.close()
    }
  })
})
