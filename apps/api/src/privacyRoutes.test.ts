import { randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import { sessionCookieName } from './authRoutes.js'

const schoolId = randomUUID(),
  studentId = randomUUID(),
  userId = randomUUID()
const actor: User = {
  id: userId,
  email: 'privacy@example.test',
  displayName: 'Requester',
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
const database = {
  student: { findFirst: vi.fn().mockResolvedValue({ id: studentId }) },
  studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
  guardianAccess: { findUnique: vi.fn().mockResolvedValue(null) },
  studentGuardian: { findFirst: vi.fn() },
  privacyRequest: {
    create: vi
      .fn()
      .mockResolvedValue({
        id: randomUUID(),
        type: 'access',
        status: 'submitted',
      }),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  user: { findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }) },
  school: {
    findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
  },
  organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
  schoolMembership: {
    findUnique: vi.fn().mockResolvedValue({ role: 'teacher' }),
  },
} as unknown as PrismaClient

it('uses authenticated identity, denies unrelated child and teacher review', async () => {
  const app = buildApp({ auth, database })
  const cookie = `${sessionCookieName}=fixture`
  try {
    const path = `/schools/${schoolId}/privacy/requests`
    expect(
      (
        await app.inject({
          method: 'POST',
          url: path,
          payload: {
            studentId,
            type: 'access',
            details: 'Please provide my records',
          },
        })
      ).statusCode,
    ).toBe(401)
    const created = await app.inject({
      method: 'POST',
      url: path,
      headers: { cookie },
      payload: {
        studentId,
        type: 'access',
        details: 'Please provide my records',
      },
    })
    expect(created.statusCode).toBe(201)
    expect(database.privacyRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterUserId: userId,
        requesterKind: 'student',
      }),
    })
    const forged = await app.inject({
      method: 'POST',
      url: path,
      headers: { cookie },
      payload: {
        studentId,
        requesterUserId: randomUUID(),
        type: 'access',
        details: 'Please provide my records',
      },
    })
    expect(forged.statusCode).toBe(400)
    vi.mocked(database.studentAccess.findUnique).mockResolvedValue(null)
    const unrelated = await app.inject({
      method: 'POST',
      url: path,
      headers: { cookie },
      payload: {
        studentId,
        type: 'access',
        details: 'Please provide my records',
      },
    })
    expect(unrelated.statusCode).toBe(403)
    expect(
      (await app.inject({ url: path, headers: { cookie } })).statusCode,
    ).toBe(403)
  } finally {
    await app.close()
  }
})
