import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@warka/database'
import { AcademicYearClosingPermissionError } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { AcademicRolloverService } from './academicRolloverService.js'

const administratorId = randomUUID(),
  teacherId = randomUUID(),
  studentId = randomUUID(),
  guardianId = randomUUID(),
  bureauId = randomUUID(),
  schoolId = randomUUID(),
  yearId = randomUUID(),
  targetYearId = randomUUID(),
  planId = randomUUID()
const auth: AuthService = {
  async login() {
    return null
  },
  async currentUser(token) {
    return [
      administratorId,
      teacherId,
      studentId,
      guardianId,
      bureauId,
    ].includes(token)
      ? ({
          id: token,
          email: 'synthetic@example.test',
          displayName: 'Synthetic user',
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies User)
      : null
  },
  async logout() {},
}
const service = {
  readiness: vi.fn(async (actorId: string, scope: string) => {
    if (actorId !== administratorId || scope !== schoolId)
      throw new AcademicYearClosingPermissionError()
    return { status: 'active', blockers: [], canClose: false }
  }),
  createPlan: vi.fn(async (actorId: string, input: { schoolId: string }) => {
    if (actorId !== administratorId || input.schoolId !== schoolId)
      throw new AcademicYearClosingPermissionError()
    return { id: planId, status: 'draft' }
  }),
  apply: vi.fn(async (actorId: string, scope: string) => {
    if (actorId !== administratorId || scope !== schoolId)
      throw new AcademicYearClosingPermissionError()
    return { planId, newEnrollments: 1 }
  }),
} as unknown as AcademicRolloverService

describe('academic rollover routes', () => {
  it('requires a session and binds school scope and actor to domain actions', async () => {
    const app = buildApp({ auth, rollover: service })
    try {
      const path = `/schools/${schoolId}/years/${yearId}/closing-readiness`
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(
        401,
      )
      const headers = { cookie: `warka_session=${administratorId}` }
      expect(
        (await app.inject({ method: 'GET', url: path, headers })).statusCode,
      ).toBe(200)
      expect(service.readiness).toHaveBeenCalledWith(
        administratorId,
        schoolId,
        yearId,
      )
      const create = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/progression-plans`,
        headers,
        payload: {
          sourceAcademicYearId: yearId,
          targetAcademicYearId: targetYearId,
        },
      })
      expect(create.statusCode).toBe(201)
      expect(service.createPlan).toHaveBeenCalledWith(administratorId, {
        schoolId,
        sourceAcademicYearId: yearId,
        targetAcademicYearId: targetYearId,
      })
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/progression-plans/${planId}/apply`,
            headers,
          })
        ).statusCode,
      ).toBe(200)
      for (const denied of [teacherId, studentId, guardianId, bureauId]) {
        expect(
          (
            await app.inject({
              method: 'POST',
              url: `/schools/${schoolId}/progression-plans/${planId}/apply`,
              headers: { cookie: `warka_session=${denied}` },
            })
          ).statusCode,
        ).toBe(404)
      }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${randomUUID()}/progression-plans`,
            headers,
            payload: {
              sourceAcademicYearId: yearId,
              targetAcademicYearId: targetYearId,
            },
          })
        ).statusCode,
      ).toBe(404)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/progression-plans`,
            headers,
            payload: {
              sourceAcademicYearId: yearId,
              targetAcademicYearId: targetYearId,
              status: 'applied',
            },
          })
        ).statusCode,
      ).toBe(400)
    } finally {
      await app.close()
    }
  })
})
