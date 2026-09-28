import { Prisma, type Assessment, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { recordAuditEvent } from './auditEvents.js'
import { getGradebookCompleteness } from './gradebookCompleteness.js'
import { ResultContextSchema, type ResultContext } from './results.js'

export class GradebookLockStateError extends Error {}

export async function assertGradebookUnlocked(
  database: PrismaClient,
  assessment: Assessment,
) {
  const lock = await database.gradebookLock.findUnique({
    where: {
      GradebookLock_context_key: {
        schoolId: assessment.schoolId,
        academicYearId: assessment.academicYearId,
        gradingPeriodId: assessment.gradingPeriodId,
        schoolClassId: assessment.schoolClassId,
        subjectId: assessment.subjectId,
      },
    },
    select: { locked: true },
  })
  if (lock?.locked) throw new GradebookLockStateError('Gradebook is locked')
}

export async function lockGradebook(
  database: PrismaClient,
  actorId: string,
  input: ResultContext,
) {
  z.uuid().parse(actorId)
  const context = ResultContextSchema.parse(input)
  await requireAcademicYearAdmin(database, actorId, context.schoolId)
  return database.$transaction(
    async (transaction) => {
      const assessments = await transaction.assessment.findMany({
        where: context,
        select: { id: true },
      })
      if (!assessments.length)
        throw new GradebookLockStateError('No assessments configured')
      for (const assessment of assessments) {
        const completeness = await getGradebookCompleteness(
          transaction as PrismaClient,
          context.schoolId,
          assessment.id,
        )
        if (!completeness.complete)
          throw new GradebookLockStateError(
            'Gradebook has blocking completeness issues',
          )
      }
      const [pendingModeration, activeWindow, existing] = await Promise.all([
        transaction.markModerationRequest.findFirst({
          where: {
            schoolId: context.schoolId,
            status: 'pending',
            mark: { assessment: context },
          },
          select: { id: true },
        }),
        transaction.markEntryWindow.findFirst({
          where: {
            schoolId: context.schoolId,
            assessment: context,
            status: { in: ['scheduled', 'open'] },
          },
          select: { id: true },
        }),
        transaction.gradebookLock.findUnique({
          where: { GradebookLock_context_key: context },
        }),
      ])
      if (pendingModeration)
        throw new GradebookLockStateError('Moderation is still pending')
      if (activeWindow)
        throw new GradebookLockStateError('Mark-entry window must be closed')
      if (existing?.locked)
        throw new GradebookLockStateError('Gradebook is already locked')
      const lock = await transaction.gradebookLock.upsert({
        where: { GradebookLock_context_key: context },
        create: { ...context, locked: true, lockedAt: new Date() },
        update: { locked: true, lockedAt: new Date() },
      })
      await transaction.gradebookLockEvent.create({
        data: { lockId: lock.id, action: 'locked', actorId },
      })
      await recordAuditEvent(transaction, {
        schoolId: context.schoolId,
        actorUserId: actorId,
        action: 'gradebook.locked',
        resourceType: 'gradebookLock',
        resourceId: lock.id,
      })
      return lock
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function unlockGradebook(
  database: PrismaClient,
  actorId: string,
  input: ResultContext,
  reason: string,
) {
  z.uuid().parse(actorId)
  const context = ResultContextSchema.parse(input)
  const text = z.string().trim().min(5).max(500).parse(reason)
  await requireAcademicYearAdmin(database, actorId, context.schoolId)
  return database.$transaction(
    async (transaction) => {
      const lock = await transaction.gradebookLock.findUnique({
        where: { GradebookLock_context_key: context },
      })
      if (!lock?.locked)
        throw new GradebookLockStateError('Locked gradebook required')
      const updated = await transaction.gradebookLock.updateMany({
        where: { id: lock.id, locked: true },
        data: { locked: false },
      })
      if (updated.count !== 1)
        throw new GradebookLockStateError('Gradebook state changed')
      await transaction.gradebookLockEvent.create({
        data: { lockId: lock.id, action: 'unlocked', actorId, reason: text },
      })
      await recordAuditEvent(transaction, {
        schoolId: context.schoolId,
        actorUserId: actorId,
        action: 'gradebook.unlocked',
        resourceType: 'gradebookLock',
        resourceId: lock.id,
        metadata: { reason: text.slice(0, 200) },
      })
      return transaction.gradebookLock.findUniqueOrThrow({
        where: { id: lock.id },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
