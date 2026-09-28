import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireMeetingTeacher } from './meetingAvailability.js'

const ReasonSchema = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .refine((value) => !/[<>]/.test(value))
export class MeetingHistoryError extends Error {}

async function transition(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
  action: 'declined' | 'cancelled' | 'completed',
  reason?: string,
) {
  z.uuid().parse(schoolId)
  z.uuid().parse(requestId)
  const safeReason =
    reason === undefined ? undefined : ReasonSchema.parse(reason)
  if (action === 'declined' && !safeReason)
    throw new MeetingHistoryError('Decline reason required')
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.parentTeacherMeetingRequest.findFirst({
        where: { id: requestId, schoolId },
      })
      if (!request) throw new MeetingHistoryError('Meeting not found')
      const teacher = request.teacherId === actorId
      const guardian = request.guardianUserId === actorId
      if (
        (action === 'cancelled' && !teacher && !guardian) ||
        (action !== 'cancelled' && !teacher)
      )
        throw new MeetingHistoryError('Meeting action not allowed')
      if (teacher)
        await requireMeetingTeacher(
          transaction as PrismaClient,
          actorId,
          schoolId,
        )
      if (
        (action === 'declined' && request.status !== 'requested') ||
        (action === 'completed' && request.status !== 'scheduled') ||
        (action === 'cancelled' &&
          !['requested', 'scheduled'].includes(request.status))
      )
        throw new MeetingHistoryError('Meeting state changed')
      const updated = await transaction.parentTeacherMeetingRequest.update({
        where: { id: request.id },
        data: { status: action },
      })
      await transaction.meetingEvent.create({
        data: {
          requestId: request.id,
          actorId,
          kind: action,
          reason: safeReason ?? null,
          previousStartAt: request.scheduledStartAt,
          previousEndAt: request.scheduledEndAt,
        },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export const declineFamilyMeeting = (
  database: PrismaClient,
  teacherId: string,
  schoolId: string,
  requestId: string,
  reason: string,
) => transition(database, teacherId, schoolId, requestId, 'declined', reason)

export const cancelFamilyMeeting = (
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
  reason?: string,
) => transition(database, actorId, schoolId, requestId, 'cancelled', reason)

export const completeFamilyMeeting = (
  database: PrismaClient,
  teacherId: string,
  schoolId: string,
  requestId: string,
) => transition(database, teacherId, schoolId, requestId, 'completed')

export async function listMeetingHistory(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
) {
  const request = await database.parentTeacherMeetingRequest.findFirst({
    where: {
      id: requestId,
      schoolId,
      OR: [{ teacherId: actorId }, { guardianUserId: actorId }],
    },
    select: { id: true },
  })
  if (!request) throw new MeetingHistoryError('Meeting not found')
  return database.meetingEvent.findMany({
    where: { requestId },
    select: {
      kind: true,
      reason: true,
      previousStartAt: true,
      previousEndAt: true,
      newStartAt: true,
      newEndAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}
