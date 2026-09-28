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
import { createAssessmentRoom } from './assessmentRooms.js'
import {
  AssessmentScheduleContextError,
  createAssessmentSchedule,
} from './assessmentSchedules.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('assessment schedules in PostgreSQL', () => {
  it('ties a draft schedule to the exact assessment context without creating marks', async () => {
    const organization = await createOrganization(database!, {
      name: 'Schedule test organization',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Schedule school',
    })
    try {
      const year = await createAcademicYear(database!, {
        schoolId: school.id,
        name: 'Schedule year',
        startsOn: '2026-09-01',
        endsOn: '2027-06-30',
      })
      const grade = await createGradeLevel(database!, {
        schoolId: school.id,
        name: 'Grade 1',
      })
      const schoolClass = await createSchoolClass(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'A',
      })
      const subject = await createSubject(database!, {
        schoolId: school.id,
        name: 'Mathematics',
      })
      const period = await createGradingPeriod(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        name: 'Term 1',
        startsOn: '2026-09-01',
        endsOn: '2026-12-31',
      })
      const assessment = await createAssessment(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        name: 'Quiz',
        maximumScore: '20',
        weight: '100',
        position: 0,
      })
      const room = await createAssessmentRoom(database!, {
        schoolId: school.id,
        name: 'Room 1',
        code: 'R1',
      })
      const input = {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        assessmentId: assessment.id,
        roomId: room.id,
        scheduledDate: '2026-10-12',
        startTime: '09:00',
        endTime: '10:00',
      }
      const schedule = await createAssessmentSchedule(database!, input)
      expect(schedule.status).toBe('draft')
      expect(
        await database!.mark.count({ where: { assessmentId: assessment.id } }),
      ).toBe(0)
      await expect(
        createAssessmentSchedule(database!, {
          ...input,
          scheduledDate: '2027-01-01',
        }),
      ).rejects.toBeInstanceOf(AssessmentScheduleContextError)
      await expect(
        createAssessmentSchedule(database!, { ...input, subjectId: room.id }),
      ).rejects.toBeInstanceOf(AssessmentScheduleContextError)
    } finally {
      await database!.assessmentSchedule.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.assessmentRoom.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.assessment.deleteMany({ where: { schoolId: school.id } })
      await database!.gradingPeriod.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.subject.deleteMany({ where: { schoolId: school.id } })
      await database!.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
