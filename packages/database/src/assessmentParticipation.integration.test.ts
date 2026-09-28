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
import { createAssessmentSchedule } from './assessmentSchedules.js'
import { createAssessmentSession } from './assessmentSessions.js'
import { createStudent } from './students.js'
import { createUser } from './users.js'
import {
  AssessmentParticipationContextError,
  recordAssessmentParticipation,
} from './assessmentParticipation.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('assessment participation in PostgreSQL', () => {
  it('requires an open session and an approved enrollment in its class', async () => {
    const organization = await createOrganization(database!, {
      name: 'Participation test',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Participation school',
    })
    const actor = await createUser(database!, {
      email: `${randomUUID()}@example.test`,
      displayName: 'Participation recorder',
    })
    const student = await createStudent(database!, {
      givenName: 'Synthetic Student',
    })
    try {
      const year = await createAcademicYear(database!, {
        schoolId: school.id,
        name: 'Participation year',
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
      const schedule = await createAssessmentSchedule(database!, {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        assessmentId: assessment.id,
        scheduledDate: '2026-10-10',
        startTime: '09:00',
        endTime: '10:00',
      })
      await database!.assessmentSchedule.update({
        where: { id: schedule.id },
        data: { status: 'scheduled' },
      })
      const session = await createAssessmentSession(
        database!,
        school.id,
        schedule.id,
      )
      const input = {
        schoolId: school.id,
        sessionId: session.id,
        studentId: student.id,
        status: 'absent' as const,
      }
      await expect(
        recordAssessmentParticipation(database!, actor.id, input),
      ).rejects.toBeInstanceOf(AssessmentParticipationContextError)
      await database!.assessmentSession.update({
        where: { id: session.id },
        data: { status: 'open' },
      })
      const wrongEnrollment = await database!.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          schoolClassId: otherClass.id,
          status: 'approved',
        },
      })
      await expect(
        recordAssessmentParticipation(database!, actor.id, input),
      ).rejects.toBeInstanceOf(AssessmentParticipationContextError)
      await database!.enrollment.update({
        where: { id: wrongEnrollment.id },
        data: { schoolClassId: schoolClass.id },
      })
      const participation = await recordAssessmentParticipation(
        database!,
        actor.id,
        input,
      )
      expect(participation.status).toBe('absent')
      expect(
        await database!.mark.count({ where: { assessmentId: assessment.id } }),
      ).toBe(0)
    } finally {
      await database!.assessmentParticipation.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.assessmentSession.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.assessmentSchedule.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.assessment.deleteMany({ where: { schoolId: school.id } })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
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
      await database!.student.delete({ where: { id: student.id } })
      await database!.user.delete({ where: { id: actor.id } })
    }
  })
})
