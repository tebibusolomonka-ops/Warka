import { Prisma, type PrismaClient } from '@prisma/client'
import {
  eligibleCourseworkEnrollment,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import { recordMark } from './marks.js'

export class CourseworkMarkTransferError extends Error {}

export async function transferCourseworkMark(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  revisionId: string,
) {
  return database.$transaction(
    async (transaction) => {
      const assignment = await transaction.courseworkAssignment.findFirst({
        where: { id: assignmentId, schoolId },
        include: { assessment: true, rubric: { include: { criteria: true } } },
      })
      if (!assignment?.assessment || !assignment.rubric)
        throw new CourseworkMarkTransferError(
          'Linked assessment and rubric required',
        )
      if (
        !(await mayManageCourseworkAssignment(
          transaction as PrismaClient,
          actorId,
          assignment,
        ))
      )
        throw new CourseworkMarkTransferError('Assignment authority required')
      const assessment = assignment.assessment
      if (
        assessment.schoolId !== schoolId ||
        assessment.academicYearId !== assignment.academicYearId ||
        assessment.gradingPeriodId !== assignment.gradingPeriodId ||
        assessment.schoolClassId !== assignment.schoolClassId ||
        assessment.subjectId !== assignment.subjectId
      )
        throw new CourseworkMarkTransferError('Assessment context changed')
      const revision = await transaction.submissionRevision.findUnique({
        where: { id: revisionId },
        include: { submission: true, review: true },
      })
      if (
        !revision?.submittedAt ||
        revision.submission.assignmentId !== assignmentId ||
        revision.submission.schoolId !== schoolId ||
        revision.submission.status !== 'submitted' ||
        revision.review?.status !== 'reviewed'
      )
        throw new CourseworkMarkTransferError(
          'Reviewed submitted revision required',
        )
      const latest = await transaction.submissionRevision.findFirst({
        where: {
          submissionId: revision.submissionId,
          submittedAt: { not: null },
        },
        orderBy: { revisionNumber: 'desc' },
        select: { id: true },
      })
      if (latest?.id !== revisionId)
        throw new CourseworkMarkTransferError(
          'Only the latest submitted revision can transfer',
        )
      const enrollment = await eligibleCourseworkEnrollment(
        transaction as PrismaClient,
        revision.submission.studentId,
        assignment,
      )
      if (enrollment?.id !== revision.submission.enrollmentId)
        throw new CourseworkMarkTransferError(
          'Student enrollment is no longer eligible',
        )
      const rubricScore = await transaction.rubricScore.findFirst({
        where: { revisionId, rubricId: assignment.rubric.id },
        orderBy: { version: 'desc' },
      })
      if (!rubricScore)
        throw new CourseworkMarkTransferError('Rubric score required')
      const maximum = assignment.rubric.criteria.reduce(
        (sum, criterion) => sum.plus(criterion.maxPoints),
        new Prisma.Decimal(0),
      )
      if (
        maximum.lte(0) ||
        rubricScore.totalPoints.lt(0) ||
        rubricScore.totalPoints.gt(maximum)
      )
        throw new CourseworkMarkTransferError('Invalid rubric total')
      if (
        await transaction.mark.findFirst({
          where: {
            schoolId,
            assessmentId: assessment.id,
            enrollmentId: enrollment.id,
          },
          select: { id: true },
        })
      )
        throw new CourseworkMarkTransferError('Official mark already exists')
      const converted = rubricScore.totalPoints
        .div(maximum)
        .mul(assessment.maximumScore)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const mark = await recordMark(transaction as PrismaClient, actorId, {
        schoolId,
        enrollmentId: enrollment.id,
        assessmentId: assessment.id,
        score: converted.toFixed(2),
      })
      const transfer = await transaction.courseworkMarkTransfer.create({
        data: {
          schoolId,
          assignmentId,
          revisionId,
          rubricScoreId: rubricScore.id,
          markId: mark.id,
          scoreTransferred: converted,
          createdById: actorId,
        },
      })
      return { mark, transfer }
    },
    { isolationLevel: 'Serializable' },
  )
}
