import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerOriginPolicy, trustedOrigins } from './originPolicy.js'

async function fixture(env: NodeJS.ProcessEnv) {
  const app = Fastify()
  registerOriginPolicy(app, env)
  app.post('/mutation', async () => ({ ok: true }))
  await app.ready()
  return app
}

describe('web origin policy', () => {
  it('allows an exact trusted credentialed origin and its preflight', async () => {
    const app = await fixture({
      WARKA_ALLOWED_ORIGINS: 'https://app.example.test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/mutation',
      headers: { origin: 'https://app.example.test' },
    })
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://app.example.test',
    )
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/mutation',
      headers: {
        origin: 'https://app.example.test',
        'access-control-request-method': 'POST',
      },
    })
    expect(preflight.statusCode).toBe(204)
    await app.close()
  })

  it('does not reflect an untrusted origin and permits non-browser clients without Origin', async () => {
    const app = await fixture({
      WARKA_ALLOWED_ORIGINS: 'https://app.example.test',
    })
    const untrusted = await app.inject({
      method: 'POST',
      url: '/mutation',
      headers: { origin: 'https://evil.example' },
    })
    expect(untrusted.headers['access-control-allow-origin']).toBeUndefined()
    expect(
      (await app.inject({ method: 'POST', url: '/mutation' })).statusCode,
    ).toBe(200)
    await app.close()
  })

  it('uses the origin portion of the public API base URL', () => {
    expect(
      trustedOrigins({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'http://127.0.0.1:4173/api',
      }),
    ).toEqual(new Set(['http://127.0.0.1:4173']))
  })

  it('rejects malformed and insecure production origins', () => {
    expect(() =>
      trustedOrigins({
        NODE_ENV: 'production',
        WARKA_ALLOWED_ORIGINS: 'http://app.example.test',
      }),
    ).toThrow()
    expect(() =>
      trustedOrigins({ WARKA_ALLOWED_ORIGINS: 'javascript:alert(1)' }),
    ).toThrow()
    expect(() =>
      trustedOrigins({
        WARKA_ALLOWED_ORIGINS: 'https://app.example.test/path',
      }),
    ).toThrow()
  })
})
