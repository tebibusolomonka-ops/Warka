import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { createAcademicYear } from './academicYears.js'
import { createGradeLevel } from './gradeLevels.js'
import { createSchoolClass } from './schoolClasses.js'
import { createSubject } from './subjects.js'
import { createGradingPeriod } from './gradingPeriods.js'
import {
  assessmentConfiguration,
  createAssessment,
  DuplicateAssessmentError,
  findAssessmentById,
  InvalidAssessmentContextError,
  listAssessments,
} from './assessments.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('assessments in PostgreSQL', () => {
  it('checks decimal values, uniqueness, readiness, and academic boundaries', async () => {
    const organization = await createOrganization(database!, {
      name: 'Assessment test',
    })
    const firstSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'First assessment school',
    })
    const otherSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other assessment school',
    })
    const schoolIds = [firstSchool.id, otherSchool.id]
    try {
      const year = await createAcademicYear(database!, {
        schoolId: firstSchool.id,
        name: 'Assessment year',
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
        schoolId: firstSchool.id,
        name: 'Grade 1',
      })
      const otherGrade = await createGradeLevel(database!, {
        schoolId: otherSchool.id,
        name: 'Grade 1',
      })
      const schoolClass = await createSchoolClass(database!, {
        schoolId: firstSchool.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'A',
      })
      const otherClass = await createSchoolClass(database!, {
        schoolId: otherSchool.id,
        academicYearId: otherYear.id,
        gradeLevelId: otherGrade.id,
        name: 'A',
      })
      const subject = await createSubject(database!, {
        schoolId: firstSchool.id,
        name: 'Mathematics',
      })
      const otherSubject = await createSubject(database!, {
        schoolId: otherSchool.id,
        name: 'Mathematics',
      })
      const period = await createGradingPeriod(database!, {
        schoolId: firstSchool.id,
        academicYearId: year.id,
        name: 'Term',
        startsOn: '2026-09-11',
        endsOn: '2027-01-31',
      })
      const otherPeriod = await createGradingPeriod(database!, {
        schoolId: otherSchool.id,
        academicYearId: otherYear.id,
        name: 'Term',
        startsOn: '2026-09-11',
        endsOn: '2027-01-31',
      })
      const input = {
        schoolId: firstSchool.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        name: 'Quiz',
        maximumScore: '25.50',
        weight: '40.00',
        position: 0,
      }
      const first = await createAssessment(database!, input)
      expect(first.maximumScore.toString()).toBe('25.5')
      expect(
        await findAssessmentById(database!, firstSchool.id, first.id),
      ).toEqual(first)
      expect(
        await findAssessmentById(database!, otherSchool.id, first.id),
      ).toBeNull()
      await expect(createAssessment(database!, input)).rejects.toBeInstanceOf(
        DuplicateAssessmentError,
      )
      await expect(
        createAssessment(database!, { ...input, name: 'Other' }),
      ).rejects.toBeInstanceOf(DuplicateAssessmentError)
      await expect(
        createAssessment(database!, {
          ...input,
          gradingPeriodId: otherPeriod.id,
          position: 1,
        }),
      ).rejects.toBeInstanceOf(InvalidAssessmentContextError)
      await expect(
        createAssessment(database!, {
          ...input,
          schoolClassId: otherClass.id,
          position: 1,
        }),
      ).rejects.toBeInstanceOf(InvalidAssessmentContextError)
      await expect(
        createAssessment(database!, {
          ...input,
          subjectId: otherSubject.id,
          position: 1,
        }),
      ).rejects.toBeInstanceOf(InvalidAssessmentContextError)
      const second = await createAssessment(database!, {
        ...input,
        name: 'Final',
        maximumScore: '100',
        weight: '60',
        position: 1,
      })
      const assessments = await listAssessments(
        database!,
        firstSchool.id,
        year.id,
        period.id,
        schoolClass.id,
        subject.id,
      )
      expect(assessments.map(({ id }) => id)).toEqual([first.id, second.id])
      expect(assessmentConfiguration(assessments).ready).toBe(true)
      expect(
        await listAssessments(
          database!,
          otherSchool.id,
          otherYear.id,
          otherPeriod.id,
          otherClass.id,
          otherSubject.id,
        ),
      ).toEqual([])
    } finally {
      await database!.assessment.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.gradingPeriod.deleteMany({
        where: { schoolId: { in: schoolIds } },
      })
      await database!.subject.deleteMany({
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
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
