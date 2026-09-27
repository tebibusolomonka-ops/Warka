import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  findSchoolMembership,
  listSchoolAssignmentsForUser,
} from './schoolMemberships.js'
import {
  findOrganizationMembership,
  listOrganizationsForUser,
} from './organizationMemberships.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('membership periods in PostgreSQL', () => {
  it('retains historical rows without granting future or expired organization and school access', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Periods Org ${suffix}` },
    })
    const school = await database!.school.create({
      data: {
        organizationId: organization.id,
        name: `Periods School ${suffix}`,
      },
    })
    const user = await database!.user.create({
      data: {
        email: `periods-${suffix}@example.test`,
        displayName: 'Periods Staff',
      },
    })
    const past = new Date(Date.now() - 86400000)
    const future = new Date(Date.now() + 86400000)
    try {
      await database!.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'administrator',
          startsAt: future,
        },
      })
      await database!.schoolMembership.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          role: 'teacher',
          startsAt: past,
          endsAt: future,
        },
      })
      expect(
        await findOrganizationMembership(database!, user.id, organization.id),
      ).toBeNull()
      expect(await listOrganizationsForUser(database!, user.id)).toEqual([])
      expect(
        await findSchoolMembership(database!, user.id, school.id),
      ).not.toBeNull()
      expect(
        await listSchoolAssignmentsForUser(database!, user.id),
      ).toHaveLength(1)
      await database!.schoolMembership.update({
        where: { userId_schoolId: { userId: user.id, schoolId: school.id } },
        data: { endsAt: past },
      })
      expect(
        await findSchoolMembership(database!, user.id, school.id),
      ).toBeNull()
      expect(await listSchoolAssignmentsForUser(database!, user.id)).toEqual([])
      expect(
        await database!.schoolMembership.count({ where: { userId: user.id } }),
      ).toBe(1)
      expect(
        await database!.organizationMembership.count({
          where: { userId: user.id },
        }),
      ).toBe(1)
    } finally {
      await database!.user.delete({ where: { id: user.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
