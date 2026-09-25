import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from '@warka/database'
import {
  prismaStudentAccountService,
  StudentAccountConflictError,
  StudentEnrollmentNotFoundError,
} from './studentAccountService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('student account provisioning in PostgreSQL', () => {
  it('creates a forced-change account atomically and rejects duplicate or cross-school requests', async () => {
    const organization = await database!.organization.create({
      data: { name: `Provision ${randomUUID()}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'First school' },
    })
    const otherSchool = await database!.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Current year',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2027-08-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade 1' },
    })
    const first = await database!.student.create({
      data: { givenName: 'First', studentReference: `WKA-${randomUUID()}` },
    })
    const second = await database!.student.create({
      data: { givenName: 'Second', studentReference: `WKA-${randomUUID()}` },
    })
    await database!.enrollment.createMany({
      data: [first, second].map((student) => ({
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
      })),
    })
    const service = prismaStudentAccountService(database!)
    const email = `student-${randomUUID()}@example.test`
    try {
      await expect(
        service.create(otherSchool.id, first.id, {
          email,
          displayName: 'First',
          initialPassword: 'initial password',
        }),
      ).rejects.toBeInstanceOf(StudentEnrollmentNotFoundError)
      const created = await service.create(school.id, first.id, {
        email,
        displayName: 'First',
        initialPassword: 'initial password',
      })
      expect(await service.status(school.id, first.id)).toMatchObject({
        status: 'active',
        email,
        mustChangePassword: true,
      })
      expect(await service.status(school.id, second.id)).toEqual({
        status: 'none',
      })
      expect(created).toEqual({
        id: expect.any(String),
        email,
        displayName: 'First',
        mustChangePassword: true,
      })
      expect(JSON.stringify(created)).not.toContain('initial password')
      const credential = await database!.passwordCredential.findUnique({
        where: { userId: created.id },
      })
      expect(credential?.mustChangePassword).toBe(true)
      expect(credential?.passwordHash).not.toContain('initial password')
      await expect(
        service.create(school.id, first.id, {
          email: `another-${randomUUID()}@example.test`,
          displayName: 'Duplicate',
          initialPassword: 'another password',
        }),
      ).rejects.toBeInstanceOf(StudentAccountConflictError)
      await expect(
        service.create(school.id, second.id, {
          email,
          displayName: 'Duplicate email',
          initialPassword: 'another password',
        }),
      ).rejects.toBeInstanceOf(StudentAccountConflictError)
      expect(
        await database!.studentAccess.findUnique({
          where: { studentId: second.id },
        }),
      ).toBeNull()
      expect(
        await database!.user.count({
          where: { displayName: 'Duplicate email' },
        }),
      ).toBe(0)
    } finally {
      await database!.user.deleteMany({ where: { email } })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.student.deleteMany({
        where: { id: { in: [first.id, second.id] } },
      })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
