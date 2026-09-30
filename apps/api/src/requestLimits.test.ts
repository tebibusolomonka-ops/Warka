import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { REQUEST_LIMITS, withinExpandedArchiveLimit } from './requestLimits.js'

describe('request size limits', () => {
  it('accepts bounded JSON and rejects oversized JSON safely', async () => {
    const app = Fastify({ bodyLimit: 100 })
    app.post('/', async (request) => request.body)
    expect(
      (await app.inject({ method: 'POST', url: '/', payload: { value: 'ok' } }))
        .statusCode,
    ).toBe(200)
    const oversized = await app.inject({
      method: 'POST',
      url: '/',
      payload: { value: 'x'.repeat(200) },
    })
    expect(oversized.statusCode).toBe(413)
    expect(oversized.body).not.toContain('stack')
    await app.close()
  })
  it('bounds aggregate expanded archive size', () => {
    expect(
      withinExpandedArchiveLimit([
        { uncompressedSize: REQUEST_LIMITS.archiveExpandedBytes },
      ]),
    ).toBe(true)
    expect(
      withinExpandedArchiveLimit([
        { uncompressedSize: REQUEST_LIMITS.archiveExpandedBytes },
        { uncompressedSize: 1 },
      ]),
    ).toBe(false)
  })
})
