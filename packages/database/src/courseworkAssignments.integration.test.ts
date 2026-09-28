import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createCourseworkAssignment,
  CourseworkAssignmentAccessError,
  CourseworkAssignmentContextError,
} from './courseworkAssignments.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('coursework assignments in PostgreSQL', () => {
  it('creates a scoped draft without a mark and rejects a mismatched assessment', async () => {
    const organization = await database!.organization.create({
      data: { name: `Coursework ${randomUUID()}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Coursework school' },
    })
    const teacher = await database!.user.create({
      data: {
        email: `coursework-${randomUUID()}@example.test`,
        displayName: 'Coursework Teacher',
        schoolMemberships: {
          create: {
            schoolId: school.id,
            role: 'teacher',
            startsAt: new Date('2026-01-01'),
          },
        },
      },
    })
    try {
      const year = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Coursework year',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade 1' },
      })
      const schoolClass = await database!.schoolClass.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          name: 'A',
        },
      })
      const subject = await database!.subject.create({
        data: { schoolId: school.id, name: 'Mathematics' },
      })
      const otherSubject = await database!.subject.create({
        data: { schoolId: school.id, name: 'Science' },
      })
      const period = await database!.gradingPeriod.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          name: 'Term',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      await database!.teachingAssignment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          userId: teacher.id,
          startsAt: new Date('2026-01-01'),
        },
      })
      const assessment = await database!.assessment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          schoolClassId: schoolClass.id,
          subjectId: otherSubject.id,
          name: 'Science quiz',
          maximumScore: '10',
          weight: '100',
          position: 0,
        },
      })
      const input = {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        title: 'Solve the problems',
        instructions: 'Complete questions 1–4.',
        dueAt: '2026-11-01T12:00:00.000Z',
      }
      const assignment = await createCourseworkAssignment(
        database!,
        teacher.id,
        input,
      )
      expect(assignment.status).toBe('draft')
      expect(assignment.assessmentId).toBeNull()
      expect(
        await database!.mark.count({ where: { schoolId: school.id } }),
      ).toBe(0)
      await expect(
        createCourseworkAssignment(database!, teacher.id, {
          ...input,
          assessmentId: assessment.id,
        }),
      ).rejects.toBeInstanceOf(CourseworkAssignmentContextError)
      await expect(
        createCourseworkAssignment(database!, teacher.id, {
          ...input,
          subjectId: otherSubject.id,
        }),
      ).rejects.toBeInstanceOf(CourseworkAssignmentAccessError)
    } finally {
      await database!.courseworkAssignment.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.assessment.deleteMany({ where: { schoolId: school.id } })
      await database!.teachingAssignment.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.gradingPeriod.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.subject.deleteMany({ where: { schoolId: school.id } })
      await database!.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.schoolMembership.deleteMany({
        where: { userId: teacher.id },
      })
      await database!.user.delete({ where: { id: teacher.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
