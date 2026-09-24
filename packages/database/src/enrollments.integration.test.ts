import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createAcademicYear } from './academicYears.js'
import { createGradeLevel } from './gradeLevels.js'
import { createSchoolClass } from './schoolClasses.js'
import { createStudent } from './students.js'
import { createUser } from './users.js'
import {
  approveEnrollment,
  createEnrollment,
  DuplicateEnrollmentError,
  findEnrollmentById,
  InvalidEnrollmentStructureError,
  InvalidEnrollmentTransitionError,
  submitEnrollment,
  withdrawEnrollment,
} from './enrollments.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('enrollment lifecycle in PostgreSQL', () => {
  it('enforces school structure, transitions, and actor history', async () => {
    const organization = await createOrganization(database!, {
      name: 'Enrollment test organization',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First school',
    })
    const otherSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other school',
    })
    const schoolIds = [school.id, otherSchool.id]
    const student = await createStudent(database!, { givenName: 'Hana' })
    const secondStudent = await createStudent(database!, { givenName: 'Marta' })
    const actor = await createUser(database!, {
      email: 'enrollment-' + randomUUID() + '@example.test',
      displayName: 'Enrollment reviewer',
    })

    try {
      const year = await createAcademicYear(database!, {
        schoolId: school.id,
        name: 'First year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const otherYear = await createAcademicYear(database!, {
        schoolId: otherSchool.id,
        name: 'Other year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const grade = await createGradeLevel(database!, {
        schoolId: school.id,
        name: 'Grade 1',
      })
      const otherGrade = await createGradeLevel(database!, {
        schoolId: otherSchool.id,
        name: 'Grade 1',
      })
      const schoolClass = await createSchoolClass(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Section A',
      })
      const otherClass = await createSchoolClass(database!, {
        schoolId: otherSchool.id,
        academicYearId: otherYear.id,
        gradeLevelId: otherGrade.id,
        name: 'Other section',
      })

      const input = {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
      }
      const draft = await createEnrollment(database!, input)
      expect(draft.status).toBe('draft')
      expect(draft.approvedAt).toBeNull()
      expect(draft.approvedById).toBeNull()
      expect(await findEnrollmentById(database!, school.id, draft.id)).toEqual(
        draft,
      )
      expect(
        await findEnrollmentById(database!, otherSchool.id, draft.id),
      ).toBeNull()
      await expect(createEnrollment(database!, input)).rejects.toBeInstanceOf(
        DuplicateEnrollmentError,
      )
      for (const invalid of [
        { academicYearId: otherYear.id },
        { gradeLevelId: otherGrade.id },
        { schoolClassId: otherClass.id },
      ]) {
        await expect(
          createEnrollment(database!, {
            ...input,
            ...invalid,
            studentId: secondStudent.id,
          }),
        ).rejects.toBeInstanceOf(InvalidEnrollmentStructureError)
      }
      await expect(
        database!.enrollment.create({
          data: {
            studentId: secondStudent.id,
            schoolId: school.id,
            academicYearId: otherYear.id,
            gradeLevelId: grade.id,
          },
        }),
      ).rejects.toThrow()

      await expect(
        approveEnrollment(database!, school.id, draft.id, actor.id),
      ).rejects.toBeInstanceOf(InvalidEnrollmentTransitionError)
      const pending = await submitEnrollment(database!, school.id, draft.id)
      expect(pending.status).toBe('pending')
      await expect(
        submitEnrollment(database!, school.id, draft.id),
      ).rejects.toBeInstanceOf(InvalidEnrollmentTransitionError)
      const approvalTime = new Date('2026-09-24T10:00:00.000Z')
      const approved = await approveEnrollment(
        database!,
        school.id,
        draft.id,
        actor.id,
        approvalTime,
      )
      expect(approved.status).toBe('approved')
      expect(approved.approvedAt).toEqual(approvalTime)
      expect(approved.approvedById).toBe(actor.id)
      await expect(
        approveEnrollment(database!, school.id, draft.id, actor.id),
      ).rejects.toBeInstanceOf(InvalidEnrollmentTransitionError)

      const withdrawalTime = new Date('2026-09-25T10:00:00.000Z')
      const withdrawn = await withdrawEnrollment(
        database!,
        school.id,
        draft.id,
        actor.id,
        withdrawalTime,
      )
      expect(withdrawn.status).toBe('withdrawn')
      expect(withdrawn.approvedAt).toEqual(approvalTime)
      expect(withdrawn.approvedById).toBe(actor.id)
      expect(withdrawn.withdrawnAt).toEqual(withdrawalTime)
      expect(withdrawn.withdrawnById).toBe(actor.id)
      await expect(
        withdrawEnrollment(database!, school.id, draft.id, actor.id),
      ).rejects.toBeInstanceOf(InvalidEnrollmentTransitionError)

      const secondDraft = await createEnrollment(database!, {
        studentId: secondStudent.id,
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
      })
      const secondWithdrawn = await withdrawEnrollment(
        database!,
        school.id,
        secondDraft.id,
        actor.id,
      )
      expect(secondWithdrawn.status).toBe('withdrawn')
    } finally {
      await database!.enrollment.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.schoolClass.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.gradeLevel.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.academicYear.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.student.deleteMany({
        where: { id: { in: [student.id, secondStudent.id] } },
      })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
