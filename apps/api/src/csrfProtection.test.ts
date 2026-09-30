import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { describe, expect, it } from 'vitest'
import {
  csrfTokenForSession,
  registerCsrfProtection,
} from './csrfProtection.js'

const session = 'session-one'
const auth = {
  login: async () => null,
  currentUser: async (token: string) =>
    token === session ? ({ id: 'user' } as never) : null,
  logout: async () => {},
}

async function fixture() {
  const app = Fastify()
  app.register(cookie)
  registerCsrfProtection(app, () => auth, {
    WARKA_ALLOWED_ORIGINS: 'https://app.example.test',
  })
  app.post('/mutation', async () => ({ ok: true }))
  await app.ready()
  return app
}

describe('CSRF protection', () => {
  it('accepts the session-bound token for a trusted browser origin', async () => {
    const app = await fixture()
    const response = await app.inject({
      method: 'POST',
      url: '/mutation',
      headers: {
        cookie: `warka_session=${session}`,
        origin: 'https://app.example.test',
        'x-csrf-token': csrfTokenForSession(session),
      },
    })
    expect(response.statusCode).toBe(200)
    await app.close()
  })

  it('rejects missing, wrong, cross-site, and mismatched-session tokens', async () => {
    const app = await fixture()
    const base = {
      method: 'POST' as const,
      url: '/mutation',
      headers: {
        cookie: `warka_session=${session}`,
        origin: 'https://app.example.test',
      },
    }
    expect((await app.inject(base)).statusCode).toBe(403)
    expect(
      (
        await app.inject({
          ...base,
          headers: { ...base.headers, 'x-csrf-token': 'wrong' },
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          ...base,
          headers: {
            ...base.headers,
            origin: 'https://evil.example',
            'x-csrf-token': csrfTokenForSession(session),
          },
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          ...base,
          headers: {
            ...base.headers,
            'x-csrf-token': csrfTokenForSession('other'),
          },
        })
      ).statusCode,
    ).toBe(403)
    await app.close()
  })

  it('keeps safe requests and unauthenticated login-style mutations usable', async () => {
    const app = await fixture()
    expect((await app.inject('/auth/csrf')).statusCode).toBe(401)
    expect(
      (await app.inject({ method: 'POST', url: '/mutation' })).statusCode,
    ).toBe(200)
    await app.close()
  })
})
