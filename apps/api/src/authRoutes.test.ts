import { describe, expect, it } from 'vitest'
import type { User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'owner@example.test',
  displayName: 'Owner',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies User
const token = 'x'.repeat(43)

function testAuth() {
  const sessions = new Map<string, User>()
  const auth: AuthService = {
    async login(email, password) {
      if (email !== user.email || password !== 'correct password') return null
      sessions.set(token, user)
      return { user, token }
    },
    async currentUser(value) {
      return sessions.get(value) ?? null
    },
    async logout(value) {
      sessions.delete(value)
    },
  }
  return { auth, sessions }
}

describe('authentication routes', () => {
  it('logs in, reads the current user, and logs out through an HttpOnly cookie', async () => {
    const { auth } = testAuth()
    const app = buildApp({ auth, production: false })

    try {
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: user.email, password: 'correct password' },
      })
      expect(login.statusCode).toBe(200)
      expect(login.json()).toEqual({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      })
      expect(login.body).not.toContain(token)
      const setCookie = String(login.headers['set-cookie'])
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('SameSite=Strict')
      expect(setCookie).toContain('Path=/')
      expect(setCookie).not.toContain('Secure')
      const cookie = setCookie.split(';')[0]!

      const current = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie },
      })
      expect(current.statusCode).toBe(200)
      expect(current.json()).toEqual(login.json())

      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie },
      })
      expect(logout.statusCode).toBe(204)
      expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0')

      const afterLogout = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie },
      })
      expect(afterLogout.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('uses the same login error for an unknown email and wrong password', async () => {
    const { auth } = testAuth()
    const app = buildApp({ auth })

    try {
      const wrong = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: user.email, password: 'wrong password' },
      })
      const unknown = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'unknown@example.test',
          password: 'correct password',
        },
      })
      expect(wrong.statusCode).toBe(401)
      expect(unknown.statusCode).toBe(401)
      expect(wrong.json()).toEqual(unknown.json())
      expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS')
      expect(wrong.headers['set-cookie']).toBeUndefined()
    } finally {
      await app.close()
    }
  })

  it('rejects an expired session and marks cookies Secure in production', async () => {
    const { auth, sessions } = testAuth()
    const app = buildApp({ auth, production: true })

    try {
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: user.email, password: 'correct password' },
      })
      const setCookie = String(login.headers['set-cookie'])
      expect(setCookie).toContain('Secure')
      sessions.clear()

      const current = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: setCookie.split(';')[0]! },
      })
      expect(current.statusCode).toBe(401)
      expect(current.json().error.code).toBe('UNAUTHENTICATED')
    } finally {
      await app.close()
    }
  })
})
