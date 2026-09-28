import { type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import { recordAuditEvent } from './auditEvents.js'
import {
  notifyCoursework,
  studentCourseworkRecipients,
} from './courseworkNotifications.js'

export class CourseworkLifecycleError extends Error {}

const plainText = z
  .string()
  .trim()
  .min(1)
  .max(10000)
  .refine((value) => !/<[^>]+>/.test(value), 'HTML is not accepted')
export const EditCourseworkDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
  instructions: plainText.optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
})

export async function editCourseworkDraft(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  input: unknown,
) {
  const value = EditCourseworkDraftSchema.parse(input)
  const assignment = await database.courseworkAssignment.findFirst({
    where: { id: assignmentId, schoolId, status: 'draft' },
  })
  if (
    !assignment ||
    !(await mayManageCourseworkAssignment(database, actorId, assignment))
  )
    throw new CourseworkLifecycleError('Editable assignment required')
  const changed = await database.courseworkAssignment.updateMany({
    where: { id: assignmentId, schoolId, status: 'draft' },
    data: {
      ...(value.title !== undefined ? { title: value.title } : {}),
      ...(value.instructions !== undefined
        ? { instructions: value.instructions }
        : {}),
      ...(value.dueAt ? { dueAt: new Date(value.dueAt) } : {}),
    },
  })
  if (!changed.count)
    throw new CourseworkLifecycleError('Assignment state changed')
  return database.courseworkAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
  })
}

export async function publishCourseworkAssignment(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  now = new Date(),
) {
  return database.$transaction(
    async (transaction) => {
      const assignment = await transaction.courseworkAssignment.findFirst({
        where: { id: assignmentId, schoolId, status: 'draft' },
        include: {
          attachments: {
            where: { removedAt: null },
            include: {
              fileAsset: {
                include: {
                  scans: {
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    take: 1,
                  },
                },
              },
            },
          },
        },
      })
      if (
        !assignment ||
        !(await mayManageCourseworkAssignment(
          transaction as PrismaClient,
          actorId,
          assignment,
        ))
      )
        throw new CourseworkLifecycleError('Publishable assignment required')
      if (assignment.dueAt <= now)
        throw new CourseworkLifecycleError('Due date must be in the future')
      if (
        assignment.attachments.some(
          ({ fileAsset }) =>
            fileAsset.status !== 'available' ||
            fileAsset.scans[0]?.status !== 'clean' ||
            fileAsset.scans[0]?.result !== 'clean',
        )
      )
        throw new CourseworkLifecycleError(
          'All active attachments require a clean scan before publication',
        )
      const changed = await transaction.courseworkAssignment.updateMany({
        where: { id: assignmentId, schoolId, status: 'draft' },
        data: { status: 'published', assignedAt: now, publishedAt: now },
      })
      if (!changed.count)
        throw new CourseworkLifecycleError('Assignment state changed')
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'coursework.published',
        resourceType: 'courseworkAssignment',
        resourceId: assignmentId,
      })
      await notifyCoursework(
        transaction,
        await studentCourseworkRecipients(transaction, assignment),
        'coursework.published',
        'New coursework assignment',
        assignmentId,
      )
      return transaction.courseworkAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function endCourseworkAssignment(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  action: 'close' | 'cancel',
  now = new Date(),
) {
  return database.$transaction(
    async (transaction) => {
      const assignment = await transaction.courseworkAssignment.findFirst({
        where: { id: assignmentId, schoolId },
      })
      if (
        !assignment ||
        !(await mayManageCourseworkAssignment(
          transaction as PrismaClient,
          actorId,
          assignment,
        ))
      )
        throw new CourseworkLifecycleError('Assignment access required')
      if (
        (action === 'close' && assignment.status !== 'published') ||
        (action === 'cancel' &&
          !['draft', 'published'].includes(assignment.status))
      )
        throw new CourseworkLifecycleError('Invalid assignment transition')
      const changed = await transaction.courseworkAssignment.updateMany({
        where: { id: assignmentId, schoolId, status: assignment.status },
        data:
          action === 'close'
            ? { status: 'closed', closedAt: now }
            : { status: 'cancelled', cancelledAt: now },
      })
      if (!changed.count)
        throw new CourseworkLifecycleError('Assignment state changed')
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action:
          action === 'close' ? 'coursework.closed' : 'coursework.cancelled',
        resourceType: 'courseworkAssignment',
        resourceId: assignmentId,
      })
      return transaction.courseworkAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function changePublishedCourseworkDueDate(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  input: { dueAt: string; reason: string },
  now = new Date(),
) {
  const dueAt = z.iso.datetime({ offset: true }).parse(input.dueAt)
  const reason = plainText.max(500).parse(input.reason)
  if (new Date(dueAt) <= now)
    throw new CourseworkLifecycleError('Due date must be in the future')
  return database.$transaction(
    async (transaction) => {
      const assignment = await transaction.courseworkAssignment.findFirst({
        where: { id: assignmentId, schoolId, status: 'published' },
      })
      if (
        !assignment ||
        !(await mayManageCourseworkAssignment(
          transaction as PrismaClient,
          actorId,
          assignment,
        ))
      )
        throw new CourseworkLifecycleError('Published assignment required')
      if (assignment.dueAt.toISOString() === new Date(dueAt).toISOString())
        return assignment
      const changed = await transaction.courseworkAssignment.updateMany({
        where: {
          id: assignmentId,
          schoolId,
          status: 'published',
          dueAt: assignment.dueAt,
        },
        data: { dueAt: new Date(dueAt) },
      })
      if (!changed.count)
        throw new CourseworkLifecycleError('Assignment state changed')
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'coursework.dueDateChanged',
        resourceType: 'courseworkAssignment',
        resourceId: assignmentId,
        metadata: {
          previousDueAt: assignment.dueAt.toISOString(),
          dueAt,
          reason,
        },
      })
      await notifyCoursework(
        transaction,
        await studentCourseworkRecipients(transaction, assignment),
        'coursework.dueDateChanged',
        'Coursework due date changed',
        assignmentId,
      )
      return transaction.courseworkAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}
