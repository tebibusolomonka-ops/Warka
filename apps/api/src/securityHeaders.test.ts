import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerSecurityHeaders } from './securityHeaders.js'

describe('HTTP security headers', () => {
  it('applies an intentional policy without broad inline script or style access', async () => {
    const app = Fastify()
    registerSecurityHeaders(app)
    app.get('/api', async () => ({ ok: true }))
    const response = await app.inject('/api')
    await app.close()
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['permissions-policy']).toContain('camera=()')
    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    )
    expect(response.headers['content-security-policy']).not.toContain(
      "'unsafe-inline'",
    )
  })
})
