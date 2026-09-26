import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { recordAuditEvent } from './auditEvents.js'

export const TrainingTypeSchema = z.enum([
  'schoolAdministration',
  'studentRegistration',
  'academicResults',
  'documentProcessing',
])
export class TrainingRecordStateError extends Error {
  constructor() {
    super('Training record cannot make this transition')
  }
}

export async function listTrainingRecords(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  return database.trainingRecord.findMany({
    where: { schoolId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { user: { select: { displayName: true } } },
  })
}

export async function assignTrainingRecord(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  userId: string,
  trainingType: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const type = TrainingTypeSchema.parse(trainingType)
  const member = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: z.uuid().parse(userId), schoolId } },
  })
  if (!member) throw new TrainingRecordStateError()
  return database.$transaction(async (transaction) => {
    const record = await transaction.trainingRecord.create({
      data: { schoolId, userId, trainingType: type, recordedById: actorId },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'training.assigned',
      resourceType: 'trainingRecord',
      resourceId: record.id,
    })
    return record
  })
}

export async function finishTrainingRecord(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  recordId: string,
  action: 'completed' | 'waived',
  reason?: string,
  now = new Date(),
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  if (action === 'waived' && (!reason || reason.trim().length < 5))
    throw new TrainingRecordStateError()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.trainingRecord.updateMany({
      where: { id: z.uuid().parse(recordId), schoolId, status: 'assigned' },
      data: {
        status: action,
        completedAt: action === 'completed' ? now : null,
        waiverReason: action === 'waived' ? reason!.trim() : null,
        recordedById: actorId,
      },
    })
    if (changed.count !== 1) throw new TrainingRecordStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: action === 'completed' ? 'training.completed' : 'training.waived',
      resourceType: 'trainingRecord',
      resourceId: recordId,
    })
    return transaction.trainingRecord.findUniqueOrThrow({
      where: { id: recordId },
    })
  })
}
