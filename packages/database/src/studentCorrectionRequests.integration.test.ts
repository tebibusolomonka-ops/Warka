import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createStudentCorrectionRequest } from './studentCorrectionRequests.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('student corrections in PostgreSQL', () => {
  it('keeps official identity unchanged until approval and preserves the prior value', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Correction Org ${suffix}` },
    })
    const school = await database!.school.create({
      data: {
        organizationId: organization.id,
        name: `Correction School ${suffix}`,
      },
    })
    const registrar = await database!.user.create({
      data: {
        email: `registrar-${suffix}@example.test`,
        displayName: 'Registrar',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'registrar' },
        },
      },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Correction Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade' },
    })
    const student = await database!.student.create({
      data: {
        studentReference: `WKA-${suffix}`,
        givenName: 'Original',
        familyName: 'Name',
      },
    })
    const enrollment = await database!.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        status: 'approved',
      },
    })
    try {
      const request = await createStudentCorrectionRequest(
        database!,
        registrar.id,
        school.id,
        student.id,
        {
          field: 'givenName',
          proposedValue: 'Corrected',
          reason: 'Birth record correction',
        },
      )
      expect(request).toMatchObject({
        previousValue: 'Original',
        proposedValue: 'Corrected',
        status: 'pending',
      })
      expect(
        (
          await database!.student.findUniqueOrThrow({
            where: { id: student.id },
          })
        ).givenName,
      ).toBe('Original')
    } finally {
      await database!.studentCorrectionRequest.deleteMany({
        where: { studentId: student.id },
      })
      await database!.enrollment.delete({ where: { id: enrollment.id } })
      await database!.student.delete({ where: { id: student.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.user.delete({ where: { id: registrar.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
