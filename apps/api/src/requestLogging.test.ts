import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { installRequestLogging, safeCorrelationId } from './requestLogging.js'

describe('structured request logging', () => {
  it('bounds correlation IDs and logs route patterns without credentials or bodies', async () => {
    expect(safeCorrelationId('abc_123')).toBe('abc_123')
    expect(safeCorrelationId('x'.repeat(100))).not.toBe('x'.repeat(100))
    const write = vi.fn()
    const app = Fastify()
    app.decorateRequest('currentUser', null)
    installRequestLogging(app, write)
    app.post('/secrets/:id', async () => ({ ok: true }))
    const response = await app.inject({
      method: 'POST',
      url: '/secrets/private-record?token=sensitive',
      headers: {
        'x-correlation-id': 'bad value',
        cookie: 'session=secret',
        authorization: 'Bearer secret',
      },
      payload: { password: 'private' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9-]{36}$/)
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        route: '/secrets/:id',
        statusCode: 200,
      }),
    )
    const serialized = JSON.stringify(write.mock.calls)
    expect(serialized).not.toContain('private-record')
    expect(serialized).not.toContain('sensitive')
    expect(serialized).not.toContain('session=secret')
    expect(serialized).not.toContain('Bearer secret')
    expect(serialized).not.toContain('password')
    await app.close()
  })
})
