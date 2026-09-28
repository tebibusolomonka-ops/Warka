import type { CourseworkAssignment, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import { effectiveCourseworkDueAt } from './assignmentExtensions.js'

export class SubmissionReviewError extends Error {}
export const CompleteSubmissionReviewSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('reviewed') }),
  z.strictObject({
    status: z.literal('returned'),
    resubmissionDueAt: z.iso.datetime({ offset: true }),
  }),
])

export async function editableCourseworkDueAt(
  database: PrismaClient,
  assignment: Pick<CourseworkAssignment, 'id' | 'status' | 'dueAt'>,
  studentId: string,
  now = new Date(),
) {
  if (assignment.status !== 'published' && assignment.status !== 'closed')
    return null
  const ordinaryDueAt = await effectiveCourseworkDueAt(
    database,
    assignment,
    studentId,
  )
  if (assignment.status === 'published' && ordinaryDueAt >= now)
    return ordinaryDueAt
  const latest = await database.submissionRevision.findFirst({
    where: {
      submittedAt: { not: null },
      submission: { assignmentId: assignment.id, studentId },
    },
    orderBy: { revisionNumber: 'desc' },
    include: { review: true },
  })
  return latest?.review?.status === 'returned' &&
    latest.review.resubmissionAllowed &&
    latest.review.resubmissionDueAt &&
    latest.review.resubmissionDueAt >= now
    ? latest.review.resubmissionDueAt
    : null
}

export async function completeSubmissionReview(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  revisionId: string,
  input: unknown,
  now = new Date(),
) {
  const value = CompleteSubmissionReviewSchema.parse(input)
  const revision = await database.submissionRevision.findUnique({
    where: { id: revisionId },
    include: { submission: { include: { assignment: true } }, review: true },
  })
  if (
    !revision ||
    !revision.submittedAt ||
    revision.submission.schoolId !== schoolId ||
    revision.submission.assignmentId !== assignmentId ||
    !revision.review ||
    revision.review.status !== 'pending'
  )
    throw new SubmissionReviewError('Pending submitted revision required')
  if (
    !(await mayManageCourseworkAssignment(
      database,
      actorId,
      revision.submission.assignment,
    ))
  )
    throw new SubmissionReviewError(
      'Class and subject review authority required',
    )
  const resubmissionDueAt =
    value.status === 'returned' ? new Date(value.resubmissionDueAt) : null
  if (resubmissionDueAt && resubmissionDueAt <= now)
    throw new SubmissionReviewError(
      'Resubmission deadline must be in the future',
    )
  const changed = await database.submissionReview.updateMany({
    where: { id: revision.review.id, status: 'pending' },
    data: {
      status: value.status,
      reviewedById: actorId,
      reviewedAt: now,
      resubmissionAllowed: value.status === 'returned',
      resubmissionDueAt,
    },
  })
  if (!changed.count) throw new SubmissionReviewError('Review state changed')
  return database.submissionReview.findUniqueOrThrow({
    where: { id: revision.review.id },
  })
}
