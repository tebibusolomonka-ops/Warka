import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createAcademicYear } from './academicYears.js'
import { createGradeLevel } from './gradeLevels.js'
import { createSchoolClass } from './schoolClasses.js'
import { createSubject } from './subjects.js'
import { createGradingPeriod } from './gradingPeriods.js'
import { createAssessment } from './assessments.js'
import { createStudent } from './students.js'
import {
  approveEnrollment,
  createEnrollment,
  submitEnrollment,
} from './enrollments.js'
import { createUser } from './users.js'
import { assignUserToSchool } from './schoolMemberships.js'
import { assignTeacher } from './teachingAssignments.js'
import {
  applyMarkImport,
  InvalidMarkImportError,
  validateMarkImport,
} from './markImport.js'
import {
  DuplicateMarkError,
  getMarksForAssessment,
  getMarksForStudentContext,
  InvalidMarkContextError,
  InvalidMarkScoreError,
  MarkPermissionError,
  recordMark,
  updateDraftMark,
} from './marks.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('student marks in PostgreSQL', () => {
  it('records scoped marks only for approved class enrollments and assigned teachers', async () => {
    const organization = await createOrganization(database!, {
      name: 'Mark test organization',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Mark school',
    })
    const otherSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other mark school',
    })
    const schools = [school.id, otherSchool.id]
    const teacher = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Test Teacher',
    })
    const administrator = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Test Administrator',
    })
    const registrar = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Test Registrar',
    })
    const otherTeacher = await createUser(database!, {
      email: randomUUID() + '@example.test',
      displayName: 'Other Teacher',
    })
    const users = [teacher.id, administrator.id, registrar.id, otherTeacher.id]
    const student = await createStudent(database!, { givenName: 'Synthetic A' })
    const secondStudent = await createStudent(database!, {
      givenName: 'Synthetic B',
    })
    const students = [student.id, secondStudent.id]
    try {
      const year = await createAcademicYear(database!, {
        schoolId: school.id,
        name: 'Mark year',
        startsOn: '2026-09-11',
        endsOn: '2027-09-10',
      })
      const grade = await createGradeLevel(database!, {
        schoolId: school.id,
        name: 'Grade 1',
      })
      const firstClass = await createSchoolClass(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'A',
      })
      const otherClass = await createSchoolClass(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'B',
      })
      const subject = await createSubject(database!, {
        schoolId: school.id,
        name: 'Mathematics',
      })
      const period = await createGradingPeriod(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        name: 'Term',
        startsOn: '2026-09-11',
        endsOn: '2027-01-31',
      })
      const assessment = await createAssessment(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: firstClass.id,
        subjectId: subject.id,
        name: 'Quiz',
        maximumScore: '25.50',
        weight: '40',
        position: 0,
      })
      const finalAssessment = await createAssessment(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: firstClass.id,
        subjectId: subject.id,
        name: 'Final',
        maximumScore: '100',
        weight: '60',
        position: 1,
      })
      await assignUserToSchool(database!, {
        userId: teacher.id,
        schoolId: school.id,
        role: 'teacher',
      })
      await assignUserToSchool(database!, {
        userId: administrator.id,
        schoolId: school.id,
        role: 'administrator',
      })
      await assignUserToSchool(database!, {
        userId: registrar.id,
        schoolId: school.id,
        role: 'registrar',
      })
      await assignUserToSchool(database!, {
        userId: otherTeacher.id,
        schoolId: otherSchool.id,
        role: 'teacher',
      })
      await assignTeacher(database!, {
        schoolId: school.id,
        userId: teacher.id,
        academicYearId: year.id,
        schoolClassId: firstClass.id,
        subjectId: subject.id,
      })
      const firstEnrollment = await createEnrollment(database!, {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: firstClass.id,
      })
      const secondEnrollment = await createEnrollment(database!, {
        schoolId: school.id,
        studentId: secondStudent.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: otherClass.id,
      })
      await submitEnrollment(database!, school.id, firstEnrollment.id)
      await approveEnrollment(
        database!,
        school.id,
        firstEnrollment.id,
        administrator.id,
      )
      await submitEnrollment(database!, school.id, secondEnrollment.id)
      await approveEnrollment(
        database!,
        school.id,
        secondEnrollment.id,
        administrator.id,
      )
      const input = {
        schoolId: school.id,
        enrollmentId: firstEnrollment.id,
        assessmentId: assessment.id,
        score: '0',
      }
      const mark = await recordMark(database!, teacher.id, input)
      expect(mark.studentId).toBe(student.id)
      expect(mark.recordedById).toBe(teacher.id)
      expect(mark.score.toString()).toBe('0')
      await expect(
        recordMark(database!, teacher.id, input),
      ).rejects.toBeInstanceOf(DuplicateMarkError)
      const updated = await updateDraftMark(
        database!,
        teacher.id,
        school.id,
        mark.id,
        '25.50',
      )
      expect(updated.score.toString()).toBe('25.5')
      expect(
        (await getMarksForAssessment(database!, school.id, assessment.id)).map(
          ({ id }) => id,
        ),
      ).toEqual([mark.id])
      expect(
        (
          await getMarksForStudentContext(
            database!,
            school.id,
            firstEnrollment.id,
            period.id,
            subject.id,
          )
        ).map(({ id }) => id),
      ).toEqual([mark.id])
      await expect(
        recordMark(database!, teacher.id, {
          ...input,
          assessmentId: finalAssessment.id,
          score: '100.01',
        }),
      ).rejects.toBeInstanceOf(InvalidMarkScoreError)
      await expect(
        recordMark(database!, teacher.id, {
          ...input,
          enrollmentId: secondEnrollment.id,
        }),
      ).rejects.toBeInstanceOf(InvalidMarkContextError)
      await expect(
        recordMark(database!, registrar.id, {
          ...input,
          assessmentId: finalAssessment.id,
        }),
      ).rejects.toBeInstanceOf(MarkPermissionError)
      await expect(
        recordMark(database!, otherTeacher.id, {
          ...input,
          assessmentId: finalAssessment.id,
        }),
      ).rejects.toBeInstanceOf(MarkPermissionError)
      await expect(
        recordMark(database!, teacher.id, {
          ...input,
          schoolId: otherSchool.id,
          assessmentId: finalAssessment.id,
        }),
      ).rejects.toBeInstanceOf(InvalidMarkContextError)
      const maximum = await recordMark(database!, administrator.id, {
        ...input,
        assessmentId: finalAssessment.id,
        score: '100',
      })
      expect(maximum.score.toString()).toBe('100')
      const validCsv =
        'studentReference,score\n' + student.studentReference + ',15.25'
      const invalidCsv =
        validCsv + '\n' + secondStudent.studentReference + ',12'
      const invalidReview = await validateMarkImport(
        database!,
        teacher.id,
        school.id,
        assessment.id,
        invalidCsv,
      )
      expect(invalidReview.problems).toContainEqual({
        line: 3,
        code: 'OUTSIDE_CLASS',
        studentReference: secondStudent.studentReference,
      })
      await expect(
        applyMarkImport(
          database!,
          teacher.id,
          school.id,
          assessment.id,
          invalidCsv,
        ),
      ).rejects.toBeInstanceOf(InvalidMarkImportError)
      expect(
        (
          await getMarksForAssessment(database!, school.id, assessment.id)
        )[0]!.score.toString(),
      ).toBe('25.5')
      expect(
        await applyMarkImport(
          database!,
          teacher.id,
          school.id,
          assessment.id,
          validCsv,
        ),
      ).toEqual({ created: 0, updated: 1 })
      expect(
        (
          await getMarksForAssessment(database!, school.id, assessment.id)
        )[0]!.score.toString(),
      ).toBe('15.25')
      await expect(
        validateMarkImport(
          database!,
          registrar.id,
          school.id,
          assessment.id,
          validCsv,
        ),
      ).rejects.toBeInstanceOf(MarkPermissionError)
      await expect(
        database!.mark.create({
          data: {
            schoolId: school.id,
            studentId: secondStudent.id,
            enrollmentId: firstEnrollment.id,
            assessmentId: assessment.id,
            score: '10',
            recordedById: teacher.id,
          },
        }),
      ).rejects.toThrow()
      expect(
        await getMarksForAssessment(database!, otherSchool.id, assessment.id),
      ).toEqual([])
    } finally {
      await database!.mark.deleteMany({ where: { schoolId: { in: schools } } })
      await database!.teachingAssignment.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.enrollment.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.assessment.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.gradingPeriod.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.subject.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.schoolClass.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.gradeLevel.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.academicYear.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: { in: schools } },
      })
      await database!.student.deleteMany({ where: { id: { in: students } } })
      await database!.user.deleteMany({ where: { id: { in: users } } })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
