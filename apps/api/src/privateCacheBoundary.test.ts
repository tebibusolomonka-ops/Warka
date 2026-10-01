import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { installDefaultCachePolicy } from './cachePolicy.js'

describe('private cache boundary', () => {
  it.each(['/api/students', '/files/downloads/asset', '/operations/status'])('marks %s no-store', async (url) => {
    const app = Fastify(); installDefaultCachePolicy(app); app.get(url, async () => ({ private: true }))
    const response = await app.inject(url)
    expect(response.headers['cache-control']).toBe('private, no-store')
    await app.close()
  })
})
