import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import { notifyCoursework } from './courseworkNotifications.js'

export class CourseworkFeedbackError extends Error {}
export const CourseworkFeedbackTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(10000)
  .refine((value) => !/<[^>]+>/.test(value), 'HTML is not accepted')

async function reviewedRevision(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  revisionId: string,
) {
  const revision = await database.submissionRevision.findUnique({
    where: { id: revisionId },
    include: { review: true, submission: { include: { assignment: true } } },
  })
  if (
    !revision?.submittedAt ||
    revision.review?.status !== 'reviewed' ||
    revision.submission.schoolId !== schoolId ||
    revision.submission.assignmentId !== assignmentId ||
    !(await mayManageCourseworkAssignment(
      database,
      actorId,
      revision.submission.assignment,
    ))
  )
    throw new CourseworkFeedbackError(
      'Reviewed revision and marking authority required',
    )
  return revision
}

export async function saveDraftCourseworkFeedback(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  revisionId: string,
  text: string,
) {
  const value = CourseworkFeedbackTextSchema.parse(text)
  await reviewedRevision(database, actorId, schoolId, assignmentId, revisionId)
  return database.$transaction(
    async (transaction) => {
      const existing = await transaction.courseworkFeedback.findUnique({
        where: { revisionId },
      })
      if (existing?.status === 'released')
        throw new CourseworkFeedbackError('Released feedback is immutable')
      return existing
        ? transaction.courseworkFeedback.update({
            where: { id: existing.id, status: 'draft' },
            data: { text: value },
          })
        : transaction.courseworkFeedback.create({
            data: { revisionId, authorId: actorId, text: value },
          })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function releaseCourseworkFeedback(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  revisionId: string,
  now = new Date(),
) {
  return database.$transaction(
    async (transaction) => {
      const revision = await reviewedRevision(
        transaction as PrismaClient,
        actorId,
        schoolId,
        assignmentId,
        revisionId,
      )
      const feedback = await transaction.courseworkFeedback.findUnique({
        where: { revisionId },
      })
      if (!feedback || feedback.status !== 'draft')
        throw new CourseworkFeedbackError('Draft feedback required')
      const changed = await transaction.courseworkFeedback.updateMany({
        where: { id: feedback.id, status: 'draft' },
        data: { status: 'released', releasedAt: now },
      })
      if (!changed.count)
        throw new CourseworkFeedbackError('Feedback state changed')
      const access = await transaction.studentAccess.findUnique({
        where: { studentId: revision.submission.studentId },
        select: { userId: true },
      })
      if (access)
        await notifyCoursework(
          transaction,
          [access.userId],
          'coursework.feedbackReleased',
          'Coursework feedback available',
          assignmentId,
        )
      return transaction.courseworkFeedback.findUniqueOrThrow({
        where: { id: feedback.id },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}
