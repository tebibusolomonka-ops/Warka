import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { Organization, PrismaClient, School } from '@warka/database'
import { createSchoolAccess } from './schoolAccess.js'

const organizationId = randomUUID()
const otherOrganizationId = randomUUID()
const schoolId = randomUUID()
const otherSchoolId = randomUUID()
const organization = {
  id: organizationId,
  name: 'First office',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Organization
const school = {
  id: schoolId,
  organizationId,
  name: 'First school',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies School
const otherSchool = { ...school, id: otherSchoolId }

function accessFor(
  organizationRoles: Map<string, string>,
  schoolRoles: Map<string, string>,
) {
  const database = {
    organizationMembership: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        const { userId, organizationId: id } = where.userId_organizationId
        const role = organizationRoles.get(`${userId}:${id}`)
        return role ? { userId, organizationId: id, role } : null
      }),
      findMany: vi.fn().mockImplementation(async ({ where }) => {
        const role = organizationRoles.get(`${where.userId}:${organizationId}`)
        return role ? [{ organization, role }] : []
      }),
    },
    schoolMembership: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        const { userId, schoolId: id } = where.userId_schoolId
        const role = schoolRoles.get(`${userId}:${id}`)
        return role ? { userId, schoolId: id, role } : null
      }),
    },
  } as unknown as PrismaClient
  return createSchoolAccess(database)
}

describe('school access', () => {
  it('allows organization owners and administrators to manage and view their schools', async () => {
    const roles = new Map([
      [`owner:${organizationId}`, 'owner'],
      [`administrator:${organizationId}`, 'administrator'],
    ])
    const access = accessFor(roles, new Map())

    for (const userId of ['owner', 'administrator']) {
      expect(await access.canManageOrganization(userId, organizationId)).toBe(
        true,
      )
      expect(await access.canViewSchool(userId, school)).toBe(true)
      expect(
        await access.canManageOrganization(userId, otherOrganizationId),
      ).toBe(false)
      expect(await access.organizationsForUser(userId)).toEqual([
        { organization, role: roles.get(`${userId}:${organizationId}`) },
      ])
    }
  })

  it('allows every school staff role only at its assigned school', async () => {
    const roles = new Map([
      [`schoolAdministrator:${schoolId}`, 'administrator'],
      [`registrar:${schoolId}`, 'registrar'],
      [`teacher:${schoolId}`, 'teacher'],
      [`approver:${schoolId}`, 'approver'],
    ])
    const access = accessFor(new Map(), roles)

    for (const userId of [
      'schoolAdministrator',
      'registrar',
      'teacher',
      'approver',
    ]) {
      expect(await access.canViewSchool(userId, school)).toBe(true)
      expect(await access.canViewSchool(userId, otherSchool)).toBe(false)
      expect(await access.canManageOrganization(userId, organizationId)).toBe(
        false,
      )
      expect(await access.organizationsForUser(userId)).toEqual([])
    }
  })

  it('keeps another organization member isolated', async () => {
    const access = accessFor(
      new Map([[`outsider:${otherOrganizationId}`, 'owner']]),
      new Map(),
    )
    expect(await access.canManageOrganization('outsider', organizationId)).toBe(
      false,
    )
    expect(await access.canViewSchool('outsider', school)).toBe(false)
  })
})
