import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'

const schoolId = randomUUID(),
  requestId = randomUUID()
const auth: AuthService = {
  login: async () => null,
  currentUser: async () => null,
  logout: async () => {},
}

describe('support request routes', () => {
  it('requires authentication for case lists, creation, replies, resolution, and close', async () => {
    const app = buildApp({ auth })
    try {
      const base = `/schools/${schoolId}/support-requests`
      const calls = [
        ['GET', base],
        ['POST', base],
        ['GET', `${base}/${requestId}`],
        ['POST', `${base}/${requestId}/replies`],
        ['POST', `${base}/${requestId}/resolve`],
        ['POST', `${base}/${requestId}/close`],
      ] as const
      for (const [method, url] of calls)
        expect((await app.inject({ method, url })).statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })
})
