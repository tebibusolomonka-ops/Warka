import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { transferCourseworkMark } from './courseworkMarkTransfers.js'
import { MarkEntryWindowStateError } from './markEntryWindows.js'
import { GradebookLockStateError } from './gradebookLocks.js'
import { ResultStateError } from './results.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('coursework mark transfer in PostgreSQL', () => {
  it('uses the official mark service, enforces every gate, and rolls back failed transfers', async () => {
    const db = database!
    const organization = await db.organization.create({
      data: { name: `Transfer ${randomUUID()}` },
    })
    const school = await db.school.create({
      data: { organizationId: organization.id, name: 'Transfer school' },
    })
    const otherSchool = await db.school.create({
      data: { organizationId: organization.id, name: 'Other school' },
    })
    const teacher = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Teacher' },
    })
    const outsider = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Outsider' },
    })
    const student = await db.student.create({
      data: { givenName: 'Learner', studentReference: randomUUID() },
    })
    try {
      await db.schoolMembership.create({
        data: {
          schoolId: school.id,
          userId: teacher.id,
          role: 'teacher',
          startsAt: new Date('2026-01-01'),
        },
      })
      await db.schoolMembership.create({
        data: {
          schoolId: school.id,
          userId: outsider.id,
          role: 'teacher',
          startsAt: new Date('2026-01-01'),
        },
      })
      const year = await db.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Year',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await db.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade' },
      })
      const schoolClass = await db.schoolClass.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          name: 'A',
        },
      })
      const subject = await db.subject.create({
        data: { schoolId: school.id, name: 'Math' },
      })
      const period = await db.gradingPeriod.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          name: 'Term',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const teaching = await db.teachingAssignment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          userId: teacher.id,
          startsAt: new Date('2026-01-01'),
        },
      })
      const enrollment = await db.enrollment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          schoolClassId: schoolClass.id,
          status: 'approved',
          approvedAt: new Date('2026-01-01'),
        },
      })
      const assessment = await db.assessment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          name: 'Coursework assessment',
          maximumScore: '20',
          weight: '100',
          position: 0,
        },
      })
      const assignment = await db.courseworkAssignment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          teachingAssignmentId: teaching.id,
          assessmentId: assessment.id,
          createdById: teacher.id,
          title: 'Problems',
          instructions: 'Solve the problems.',
          dueAt: new Date('2026-11-01'),
          status: 'published',
        },
      })
      const rubric = await db.courseworkRubric.create({
        data: {
          schoolId: school.id,
          assignmentId: assignment.id,
          title: 'Rubric',
          createdById: teacher.id,
          criteria: {
            create: [
              {
                title: 'Answer',
                description: 'Accuracy',
                maxPoints: '10',
                sortOrder: 0,
              },
            ],
          },
        },
      })
      const submission = await db.courseworkSubmission.create({
        data: {
          schoolId: school.id,
          assignmentId: assignment.id,
          studentId: student.id,
          enrollmentId: enrollment.id,
          status: 'submitted',
          submittedAt: new Date(),
        },
      })
      const revision = await db.submissionRevision.create({
        data: {
          submissionId: submission.id,
          revisionNumber: 1,
          textResponse: 'My answer',
          submittedAt: new Date(),
          review: {
            create: {
              status: 'reviewed',
              reviewedById: teacher.id,
              reviewedAt: new Date(),
            },
          },
        },
      })
      const score = await db.rubricScore.create({
        data: {
          revisionId: revision.id,
          rubricId: rubric.id,
          version: 1,
          totalPoints: '7.5',
          scoredById: teacher.id,
        },
      })
      const transfer = () =>
        transferCourseworkMark(
          db,
          teacher.id,
          school.id,
          assignment.id,
          revision.id,
        )
      await expect(
        transferCourseworkMark(
          db,
          outsider.id,
          school.id,
          assignment.id,
          revision.id,
        ),
      ).rejects.toThrow()
      await expect(
        transferCourseworkMark(
          db,
          teacher.id,
          otherSchool.id,
          assignment.id,
          revision.id,
        ),
      ).rejects.toThrow()
      expect(
        await db.mark.count({ where: { assessmentId: assessment.id } }),
      ).toBe(0)
      const window = await db.markEntryWindow.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          assessmentId: assessment.id,
          opensAt: new Date('2026-01-01'),
          closesAt: new Date('2026-12-31'),
          status: 'closed',
          createdById: teacher.id,
        },
      })
      await expect(transfer()).rejects.toBeInstanceOf(MarkEntryWindowStateError)
      await db.markEntryWindow.update({
        where: { id: window.id },
        data: { status: 'open' },
      })
      const lock = await db.gradebookLock.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          locked: true,
        },
      })
      await expect(transfer()).rejects.toBeInstanceOf(GradebookLockStateError)
      await db.gradebookLock.update({
        where: { id: lock.id },
        data: { locked: false },
      })
      const resultSet = await db.resultSet.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradingPeriodId: period.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          status: 'published',
        },
      })
      await expect(transfer()).rejects.toBeInstanceOf(ResultStateError)
      await db.resultSet.update({
        where: { id: resultSet.id },
        data: { status: 'draft' },
      })
      expect(
        await db.mark.count({ where: { assessmentId: assessment.id } }),
      ).toBe(0)
      const failingClient = db.$extends({
        query: {
          courseworkMarkTransfer: {
            create() {
              throw new Error('Injected transfer persistence failure')
            },
          },
        },
      }) as unknown as PrismaClient
      await expect(
        transferCourseworkMark(
          failingClient,
          teacher.id,
          school.id,
          assignment.id,
          revision.id,
        ),
      ).rejects.toThrow('Injected transfer persistence failure')
      expect(
        await db.mark.count({ where: { assessmentId: assessment.id } }),
      ).toBe(0)
      const result = await transfer()
      expect(result.mark.score.toString()).toBe('15')
      expect(result.mark.recordedById).toBe(teacher.id)
      expect(result.transfer.rubricScoreId).toBe(score.id)
      expect(await db.rubricScore.count({ where: { id: score.id } })).toBe(1)
      await expect(transfer()).rejects.toThrow('Official mark already exists')
      expect(
        await db.mark.count({ where: { assessmentId: assessment.id } }),
      ).toBe(1)
    } finally {
      await db.courseworkMarkTransfer.deleteMany({
        where: { schoolId: school.id },
      })
      await db.mark.deleteMany({ where: { schoolId: school.id } })
      await db.resultSet.deleteMany({ where: { schoolId: school.id } })
      await db.gradebookLock.deleteMany({ where: { schoolId: school.id } })
      await db.markEntryWindow.deleteMany({ where: { schoolId: school.id } })
      await db.rubricCriterionScore.deleteMany({
        where: { score: { rubric: { schoolId: school.id } } },
      })
      await db.rubricScore.deleteMany({
        where: { rubric: { schoolId: school.id } },
      })
      await db.submissionReview.deleteMany({
        where: { revision: { submission: { schoolId: school.id } } },
      })
      await db.submissionRevision.deleteMany({
        where: { submission: { schoolId: school.id } },
      })
      await db.courseworkSubmission.deleteMany({
        where: { schoolId: school.id },
      })
      await db.rubricCriterion.deleteMany({
        where: { rubric: { schoolId: school.id } },
      })
      await db.courseworkRubric.deleteMany({ where: { schoolId: school.id } })
      await db.courseworkAssignment.deleteMany({
        where: { schoolId: school.id },
      })
      await db.assessment.deleteMany({ where: { schoolId: school.id } })
      await db.enrollment.deleteMany({ where: { schoolId: school.id } })
      await db.teachingAssignment.deleteMany({ where: { schoolId: school.id } })
      await db.gradingPeriod.deleteMany({ where: { schoolId: school.id } })
      await db.subject.deleteMany({ where: { schoolId: school.id } })
      await db.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await db.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await db.academicYear.deleteMany({ where: { schoolId: school.id } })
      await db.schoolMembership.deleteMany({ where: { schoolId: school.id } })
      await db.student.delete({ where: { id: student.id } })
      await db.user.deleteMany({
        where: { id: { in: [teacher.id, outsider.id] } },
      })
      await db.school.deleteMany({
        where: { id: { in: [school.id, otherSchool.id] } },
      })
      await db.organization.delete({ where: { id: organization.id } })
    }
  })
})
