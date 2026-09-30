import { expect, test } from '@playwright/test'

test('public responses carry hardened headers and reject untrusted origins', async ({
  request,
}) => {
  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(health.headers()['x-content-type-options']).toBe('nosniff')
  expect(health.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  )
  expect(health.headers()['cross-origin-resource-policy']).toBe('same-site')

  const untrusted = await request.post('/api/auth/login', {
    headers: { origin: 'https://untrusted.example.test' },
    data: { email: 'nobody@example.test', password: 'irrelevant' },
  })
  expect(untrusted.status()).toBe(403)
  expect(untrusted.headers()['access-control-allow-origin']).toBeUndefined()
})

test('state-changing requests require CSRF evidence and posture stays protected', async ({
  request,
}) => {
  const missingCsrf = await request.post('/api/auth/logout', {
    headers: {
      cookie: 'warka_session=synthetic-session',
      origin: 'http://127.0.0.1:4173',
    },
  })
  expect(missingCsrf.status()).toBe(403)

  const csrf = await request.get('/api/auth/csrf')
  expect(csrf.status()).toBe(401)

  const posture = await request.get('/api/operations/security')
  expect(posture.status()).toBe(401)
  expect(await posture.text()).not.toMatch(
    /database_url|password|private key|session token/i,
  )
})
