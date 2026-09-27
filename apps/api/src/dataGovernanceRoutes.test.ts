import { randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import { sessionCookieName } from './authRoutes.js'

const schoolId = randomUUID(),
  organizationId = randomUUID(),
  userId = randomUUID()
const actor: User = {
  id: userId,
  email: 'governance@example.test',
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
const database = {
  user: { findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }) },
  school: { findUnique: vi.fn().mockResolvedValue({ organizationId }) },
  organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
  schoolMembership: {
    findUnique: vi.fn().mockResolvedValue({ role: 'teacher' }),
  },
  privacyRequest: {
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
  },
  processingRestriction: { count: vi.fn().mockResolvedValue(0) },
  studentCorrectionRequest: { findMany: vi.fn().mockResolvedValue([]) },
  auditEvent: { findMany: vi.fn().mockResolvedValue([]) },
} as unknown as PrismaClient

it('denies teacher summaries and returns only aggregates to an administrator', async () => {
  const app = buildApp({ auth, database })
  const path = `/schools/${schoolId}/data-governance/summary`
  try {
    expect((await app.inject(path)).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          url: path,
          headers: { cookie: `${sessionCookieName}=fixture` },
        })
      ).statusCode,
    ).toBe(403)
    vi.mocked(database.schoolMembership.findUnique).mockResolvedValue({
      role: 'administrator',
    } as never)
    const response = await app.inject({
      url: path,
      headers: { cookie: `${sessionCookieName}=fixture` },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      organizationId,
      schoolId,
      openRequests: 0,
      activeRestrictions: 0,
    })
  } finally {
    await app.close()
  }
})
