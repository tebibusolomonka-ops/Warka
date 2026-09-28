import { type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { visibleCourseworkAssignmentForStudent } from './courseworkAudience.js'
import { effectiveCourseworkDueAt } from './assignmentExtensions.js'

export class SubmissionRevisionError extends Error {}
export const SubmissionTextSchema = z
  .string()
  .max(20000)
  .refine((value) => !/<[^>]+>/.test(value), 'HTML is not accepted')

async function editableAudience(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  now: Date,
) {
  const audience = await visibleCourseworkAssignmentForStudent(
    database,
    actorId,
    assignmentId,
    now,
  )
  if (
    !audience ||
    (await effectiveCourseworkDueAt(
      database,
      audience.assignment,
      audience.studentId,
    )) < now
  )
    throw new SubmissionRevisionError('Assignment is not open to this student')
  return audience
}

export async function saveDraftSubmissionRevision(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  textResponse: string,
  now = new Date(),
) {
  const text = SubmissionTextSchema.parse(textResponse)
  const audience = await editableAudience(database, actorId, assignmentId, now)
  return database.$transaction(
    async (transaction) => {
      const submission = await transaction.courseworkSubmission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: audience.studentId,
          },
        },
      })
      if (!submission || submission.status === 'withdrawn')
        throw new SubmissionRevisionError('Active submission required')
      const latest = await transaction.submissionRevision.findFirst({
        where: { submissionId: submission.id },
        orderBy: { revisionNumber: 'desc' },
      })
      if (latest && !latest.submittedAt)
        return transaction.submissionRevision.update({
          where: { id: latest.id, submittedAt: null },
          data: { textResponse: text },
        })
      return transaction.submissionRevision.create({
        data: {
          submissionId: submission.id,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          textResponse: text,
        },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function submitCourseworkRevision(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  now = new Date(),
) {
  const audience = await editableAudience(database, actorId, assignmentId, now)
  return database.$transaction(
    async (transaction) => {
      const submission = await transaction.courseworkSubmission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: audience.studentId,
          },
        },
      })
      if (!submission || submission.status === 'withdrawn')
        throw new SubmissionRevisionError('Active submission required')
      const latest = await transaction.submissionRevision.findFirst({
        where: { submissionId: submission.id },
        orderBy: { revisionNumber: 'desc' },
      })
      if (!latest || latest.submittedAt)
        throw new SubmissionRevisionError('Draft revision required')
      const changed = await transaction.submissionRevision.updateMany({
        where: { id: latest.id, submittedAt: null },
        data: { submittedAt: now },
      })
      if (!changed.count)
        throw new SubmissionRevisionError('Revision state changed')
      await transaction.courseworkSubmission.update({
        where: { id: submission.id },
        data: { status: 'submitted', submittedAt: now },
      })
      return transaction.submissionRevision.findUniqueOrThrow({
        where: { id: latest.id },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function withdrawCourseworkSubmission(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  now = new Date(),
) {
  const audience = await editableAudience(database, actorId, assignmentId, now)
  const changed = await database.courseworkSubmission.updateMany({
    where: {
      assignmentId,
      studentId: audience.studentId,
      status: { in: ['draft', 'submitted'] },
    },
    data: { status: 'withdrawn' },
  })
  if (!changed.count)
    throw new SubmissionRevisionError('Active submission required')
  return { withdrawn: true }
}

export async function listOwnSubmissionRevisions(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  now = new Date(),
) {
  const audience = await visibleCourseworkAssignmentForStudent(
    database,
    actorId,
    assignmentId,
    now,
  )
  if (!audience)
    throw new SubmissionRevisionError(
      'Assignment is not visible to this student',
    )
  const submission = await database.courseworkSubmission.findUnique({
    where: {
      assignmentId_studentId: { assignmentId, studentId: audience.studentId },
    },
  })
  if (!submission) return []
  return database.submissionRevision.findMany({
    where: { submissionId: submission.id },
    orderBy: { revisionNumber: 'desc' },
  })
}
