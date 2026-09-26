import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  getSchoolDocumentProfile,
  saveSchoolDocumentProfile,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => {
  await database?.$disconnect()
})
describe.skipIf(!database)('school document profiles in PostgreSQL', () => {
  it('keeps official identity scoped to administrators and persists validated fields', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Profile organization ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Profile school' },
    })
    const admin = await database!.user.create({
      data: {
        email: `profile-admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const registrar = await database!.user.create({
      data: {
        email: `profile-registrar-${suffix}@example.test`,
        displayName: 'Registrar',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'registrar' },
        },
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: `profile-teacher-${suffix}@example.test`,
        displayName: 'Teacher',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
      },
    })
    try {
      expect(
        await getSchoolDocumentProfile(database!, admin.id, school.id),
      ).toBeNull()
      const profile = await saveSchoolDocumentProfile(
        database!,
        admin.id,
        school.id,
        {
          officialName: 'Official School',
          email: 'office@example.test',
          website: 'https://example.test',
        },
      )
      expect(profile.officialName).toBe('Official School')
      expect(
        (await getSchoolDocumentProfile(database!, registrar.id, school.id))
          ?.email,
      ).toBe('office@example.test')
      await expect(
        saveSchoolDocumentProfile(database!, registrar.id, school.id, {
          officialName: 'Wrong',
        }),
      ).rejects.toThrow('permission denied')
      await expect(
        getSchoolDocumentProfile(database!, teacher.id, school.id),
      ).rejects.toThrow('permission denied')
      await expect(
        saveSchoolDocumentProfile(database!, admin.id, school.id, {
          website: 'javascript:alert(1)',
        }),
      ).rejects.toThrow()
      expect(
        await database!.auditEvent.count({
          where: {
            schoolId: school.id,
            action: 'schoolDocumentProfile.updated',
          },
        }),
      ).toBe(1)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, registrar.id, teacher.id] } },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
