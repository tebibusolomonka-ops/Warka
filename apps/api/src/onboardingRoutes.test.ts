import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { OnboardingService } from './onboardingService.js'

const actorId = randomUUID(),
  schoolId = randomUUID(),
  userId = randomUUID()
const user = {
  id: actorId,
  email: 'onboarding-admin@example.test',
  displayName: 'Admin',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies User

describe('school onboarding routes', () => {
  it('requires a session and passes actor and school scope to explicit actions', async () => {
    const start = vi.fn(async () => ({ status: 'inProgress' }))
    const updateManual = vi.fn(async () => ({
      key: 'backupContactConfirmed',
      status: 'complete',
    }))
    const complete = vi.fn(async () => ({ status: 'completed' }))
    const onboarding = {
      start,
      updateManual,
      complete,
    } as unknown as OnboardingService
    const auth: AuthService = {
      login: async () => null,
      currentUser: async (token) => (token === 'admin' ? user : null),
      logout: async () => {},
    }
    const app = buildApp({ auth, onboarding })
    const path = `/schools/${schoolId}/onboarding`
    const headers = { cookie: 'warka_session=admin' }
    try {
      expect(
        (await app.inject({ method: 'POST', url: `${path}/start` })).statusCode,
      ).toBe(401)
      expect(
        (await app.inject({ method: 'POST', url: `${path}/start`, headers }))
          .statusCode,
      ).toBe(200)
      expect(start).toHaveBeenCalledWith(actorId, schoolId)
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `${path}/checklist/backupContactConfirmed`,
            headers,
            payload: { status: 'complete' },
          })
        ).statusCode,
      ).toBe(200)
      expect(updateManual).toHaveBeenCalledWith(
        actorId,
        schoolId,
        'backupContactConfirmed',
        'complete',
      )
      expect(
        (await app.inject({ method: 'POST', url: `${path}/complete`, headers }))
          .statusCode,
      ).toBe(200)
      expect(complete).toHaveBeenCalledWith(actorId, schoolId)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `${path}/training`,
            headers,
            payload: { userId, trainingType: 'imaginary' },
          })
        ).statusCode,
      ).toBe(400)
    } finally {
      await app.close()
    }
  })
})
