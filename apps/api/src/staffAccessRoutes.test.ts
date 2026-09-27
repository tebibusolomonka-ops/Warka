import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import { sessionCookieName } from './authRoutes.js'

const schoolId = randomUUID()
const otherSchoolId = randomUUID()
const organizationId = randomUUID()
const actor: User = {
  id: randomUUID(),
  email: 'staff-admin@example.test',
  displayName: 'Staff Admin',
  accountStatus: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
}
let role: string | null = 'administrator'
const database = {
  school: {
    findUnique: vi
      .fn()
      .mockImplementation(async ({ where }) =>
        where.id === schoolId ? { organizationId } : null,
      ),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
  schoolMembership: {
    findUnique: vi
      .fn()
      .mockImplementation(async () =>
        role ? { role, startsAt: new Date(0), endsAt: null } : null,
      ),
  },
} as unknown as PrismaClient
const auth: AuthService = {
  login: async () => null,
  currentUser: async () => actor,
  logout: async () => {},
  passwordState: async () => false,
}
const app = buildApp({ database, auth })
afterEach(async () => {
  await app.close()
})

describe('staff access routes', () => {
  it('requires authentication and administrator school scope', async () => {
    const path = `/schools/${schoolId}/staff-access`
    expect((await app.inject(path)).statusCode).toBe(401)
    role = 'teacher'
    expect(
      (
        await app.inject({
          url: path,
          headers: { cookie: `${sessionCookieName}=fixture` },
        })
      ).statusCode,
    ).toBe(403)
    role = 'administrator'
    const allowed = await app.inject({
      url: path,
      headers: { cookie: `${sessionCookieName}=fixture` },
    })
    expect(allowed.statusCode).toBe(200)
    expect(allowed.json()).toMatchObject({ total: 0, items: [] })
    expect(
      (
        await app.inject({
          url: `/schools/${otherSchoolId}/staff-access`,
          headers: { cookie: `${sessionCookieName}=fixture` },
        })
      ).statusCode,
    ).toBe(403)
  })
})
