import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createAcademicYear } from './academicYears.js'
import { createGradeLevel } from './gradeLevels.js'
import { createStudent } from './students.js'
import { createEnrollment } from './enrollments.js'
import { registerStudentRecord } from './studentRegistration.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('duplicate warnings in PostgreSQL', () => {
  it('warns only within the registering school and never merges students', async () => {
    const organization = await createOrganization(database!, {
      name: 'Duplicate review test organization',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First school',
    })
    const secondSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Second school',
    })
    const year = await createAcademicYear(database!, {
      schoolId: firstSchool.id,
      name: 'First year',
      startsOn: '2026-09-11',
      endsOn: '2027-09-10',
    })
    const grade = await createGradeLevel(database!, {
      schoolId: firstSchool.id,
      name: 'Grade 1',
    })
    const existing = await createStudent(database!, {
      givenName: 'Hana',
      familyName: 'Bekele',
      dateOfBirth: '2018-02-28',
    })
    const createdIds: string[] = [existing.id]

    try {
      await createEnrollment(database!, {
        studentId: existing.id,
        schoolId: firstSchool.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
      })
      const sameSchool = await registerStudentRecord(
        database!,
        firstSchool.id,
        {
          givenName: ' HANA ',
          familyName: ' bekele ',
          dateOfBirth: '2018-02-28',
        },
      )
      createdIds.push(sameSchool.student.id)
      expect(sameSchool.possibleDuplicates).toMatchObject([
        { id: existing.id, studentReference: existing.studentReference },
      ])
      expect(sameSchool.student.id).not.toBe(existing.id)
      expect(
        await database!.student.findUnique({ where: { id: existing.id } }),
      ).toEqual(existing)

      const otherSchool = await registerStudentRecord(
        database!,
        secondSchool.id,
        {
          givenName: 'Hana',
          familyName: 'Bekele',
          dateOfBirth: '2018-02-28',
        },
      )
      createdIds.push(otherSchool.student.id)
      expect(otherSchool.possibleDuplicates).toEqual([])

      const otherBirthDate = await registerStudentRecord(
        database!,
        firstSchool.id,
        {
          givenName: 'Hana',
          familyName: 'Bekele',
          dateOfBirth: '2017-02-28',
        },
      )
      createdIds.push(otherBirthDate.student.id)
      expect(otherBirthDate.possibleDuplicates).toEqual([])

      const missingBirthDate = await registerStudentRecord(
        database!,
        firstSchool.id,
        {
          givenName: 'Hana',
          familyName: 'Bekele',
        },
      )
      createdIds.push(missingBirthDate.student.id)
      expect(missingBirthDate.possibleDuplicates).toEqual([])
    } finally {
      await database!.enrollment.deleteMany({
        where: { schoolId: firstSchool.id },
      })
      await database!.student.deleteMany({ where: { id: { in: createdIds } } })
      await database!.gradeLevel.deleteMany({
        where: { schoolId: firstSchool.id },
      })
      await database!.academicYear.deleteMany({
        where: { schoolId: firstSchool.id },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
