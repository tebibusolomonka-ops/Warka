import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import { sessionCookieName } from './authRoutes.js'

const schoolId = randomUUID(),
  studentId = randomUUID(),
  enrollmentId = randomUUID()
const actor: User = {
  id: randomUUID(),
  email: 'correction-admin@example.test',
  displayName: 'Administrator',
  accountStatus: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
}
const auth: AuthService = {
  login: async () => null,
  currentUser: async () => actor,
  logout: async () => {},
  passwordState: async () => false,
}
let role = 'teacher'
const database = {
  school: {
    findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
  },
  user: { findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }) },
  organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
  schoolMembership: {
    findUnique: vi
      .fn()
      .mockImplementation(async () => ({
        role,
        startsAt: new Date(0),
        endsAt: null,
      })),
  },
  studentCorrectionRequest: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
} as unknown as PrismaClient

describe('correction routes', () => {
  it('requires authentication, denies teacher review, and shows a scoped administrator queue', async () => {
    const app = buildApp({ auth, database })
    try {
      const cookie = `${sessionCookieName}=fixture`
      const studentPath = `/schools/${schoolId}/students/${studentId}/corrections`
      const enrollmentPath = `/schools/${schoolId}/enrollments/${enrollmentId}/corrections`
      const queue = `/schools/${schoolId}/corrections/student`
      expect(
        (await app.inject({ method: 'POST', url: studentPath })).statusCode,
      ).toBe(401)
      expect(
        (await app.inject({ method: 'POST', url: enrollmentPath })).statusCode,
      ).toBe(401)
      expect((await app.inject(queue)).statusCode).toBe(401)
      expect(
        (await app.inject({ url: queue, headers: { cookie } })).statusCode,
      ).toBe(403)
      role = 'administrator'
      const response = await app.inject({ url: queue, headers: { cookie } })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ total: 0, items: [] })
    } finally {
      await app.close()
    }
  })
})
