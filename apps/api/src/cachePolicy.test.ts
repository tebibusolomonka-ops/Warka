import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import {
  installDefaultCachePolicy,
  privateConditionalCache,
} from './cachePolicy.js'

describe('private conditional caching', () => {
  it('returns 304 only for an unchanged resource in the same authorization context', async () => {
    const app = Fastify()
    app.decorateRequest('currentUser', null)
    installDefaultCachePolicy(app)
    let value = 'Published announcement'
    app.get(
      '/published',
      {
        preHandler: async (request) => {
          request.currentUser = {
            id: String(request.headers['x-user']),
          } as never
        },
        onSend: privateConditionalCache,
      },
      () => ({ title: value }),
    )
    app.get('/auth/me', () => ({ session: 'sensitive' }))
    const first = await app.inject({
      url: '/published',
      headers: { 'x-user': 'actor-a' },
    })
    expect(first.statusCode).toBe(200)
    expect(first.headers['cache-control']).toBe(
      'private, max-age=0, must-revalidate',
    )
    expect(first.headers.vary).toBe('Cookie')
    const etag = String(first.headers.etag)
    const unchanged = await app.inject({
      url: '/published',
      headers: { 'x-user': 'actor-a', 'if-none-match': etag },
    })
    expect(unchanged.statusCode).toBe(304)
    expect(unchanged.body).toBe('')
    const other = await app.inject({
      url: '/published',
      headers: { 'x-user': 'actor-b', 'if-none-match': etag },
    })
    expect(other.statusCode).toBe(200)
    expect(other.headers.etag).not.toBe(etag)
    value = 'Updated announcement'
    const changed = await app.inject({
      url: '/published',
      headers: { 'x-user': 'actor-a', 'if-none-match': etag },
    })
    expect(changed.statusCode).toBe(200)
    expect(changed.headers.etag).not.toBe(etag)
    expect((await app.inject('/auth/me')).headers['cache-control']).toBe(
      'private, no-store',
    )
    await app.close()
  })
})
