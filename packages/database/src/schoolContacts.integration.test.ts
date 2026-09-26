import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createSchoolContact,
  listSchoolContacts,
  SchoolContactSchema,
} from './schoolContacts.js'
import { AcademicYearClosingPermissionError } from './academicYearClosing.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('school contacts in PostgreSQL', () => {
  it('keeps contacts private to an administrator in the same school', async () => {
    const suffix = randomUUID()
    const org = await database!.organization.create({
      data: { name: `Contacts ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: org.id, name: `Contacts School ${suffix}` },
    })
    const other = await database!.school.create({
      data: { organizationId: org.id, name: `Other Contacts School ${suffix}` },
    })
    const admin = await database!.user.create({
      data: {
        email: `contact-admin-${suffix}@example.test`,
        displayName: 'Admin',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const teacher = await database!.user.create({
      data: {
        email: `contact-teacher-${suffix}@example.test`,
        displayName: 'Teacher',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
      },
    })
    try {
      const contact = await createSchoolContact(
        database!,
        admin.id,
        school.id,
        {
          name: 'Operations Contact',
          role: 'primary',
          email: 'contact@example.test',
        },
      )
      expect(
        (await listSchoolContacts(database!, admin.id, school.id)).map(
          (item) => item.id,
        ),
      ).toContain(contact.id)
      await expect(
        listSchoolContacts(database!, teacher.id, school.id),
      ).rejects.toBeInstanceOf(AcademicYearClosingPermissionError)
      await expect(
        listSchoolContacts(database!, admin.id, other.id),
      ).rejects.toBeInstanceOf(AcademicYearClosingPermissionError)
      expect(
        SchoolContactSchema.safeParse({
          name: 'A',
          role: 'primary',
          email: 'not-email',
        }).success,
      ).toBe(false)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.user.deleteMany({
        where: { id: { in: [admin.id, teacher.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, other.id] } },
      })
      await database!.organization.delete({ where: { id: org.id } })
    }
  })
})
