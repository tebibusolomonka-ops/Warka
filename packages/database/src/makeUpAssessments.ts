import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)

export const MakeUpRequestSchema = z.strictObject({
  schoolId: z.uuid(),
  originalParticipationId: z.uuid(),
  reason: z.string().trim().min(5).max(1000),
})

export const MakeUpScheduleSchema = z
  .strictObject({
    scheduledDate: z.iso.date(),
    startTime: time,
    endTime: time,
  })
  .refine((value) => value.startTime < value.endTime, { path: ['endTime'] })

export class MakeUpAssessmentStateError extends Error {}

export async function requestMakeUpAssessment(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof MakeUpRequestSchema>,
) {
  z.uuid().parse(actorId)
  const value = MakeUpRequestSchema.parse(input)
  const participation = await database.assessmentParticipation.findFirst({
    where: {
      id: value.originalParticipationId,
      schoolId: value.schoolId,
      status: { in: ['absent', 'excused'] },
    },
    select: { sessionId: true, studentId: true },
  })
  if (!participation)
    throw new MakeUpAssessmentStateError('Missed participation required')
  try {
    return await database.makeUpAssessment.create({
      data: {
        schoolId: value.schoolId,
        originalSessionId: participation.sessionId,
        originalParticipationId: value.originalParticipationId,
        studentId: participation.studentId,
        reason: value.reason,
        createdById: actorId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new MakeUpAssessmentStateError('Make-up request already exists')
    }
    throw error
  }
}

export async function reviewMakeUpAssessment(
  database: PrismaClient,
  schoolId: string,
  id: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
) {
  z.uuid().parse(reviewerId)
  const updated = await database.makeUpAssessment.updateMany({
    where: { id, schoolId, status: 'requested' },
    data: {
      status: decision,
      approvedById: reviewerId,
      reviewedAt: new Date(),
    },
  })
  if (updated.count !== 1)
    throw new MakeUpAssessmentStateError('Requested make-up required')
  return database.makeUpAssessment.findUniqueOrThrow({ where: { id } })
}

export async function scheduleMakeUpAssessment(
  database: PrismaClient,
  schoolId: string,
  id: string,
  input: z.input<typeof MakeUpScheduleSchema>,
) {
  const value = MakeUpScheduleSchema.parse(input)
  const updated = await database.makeUpAssessment.updateMany({
    where: { id, schoolId, status: 'approved' },
    data: {
      status: 'scheduled',
      scheduledDate: new Date(`${value.scheduledDate}T00:00:00.000Z`),
      startTime: value.startTime,
      endTime: value.endTime,
    },
  })
  if (updated.count !== 1)
    throw new MakeUpAssessmentStateError('Approved make-up required')
  return database.makeUpAssessment.findUniqueOrThrow({ where: { id } })
}

export async function completeMakeUpAssessment(
  database: PrismaClient,
  schoolId: string,
  id: string,
) {
  const updated = await database.makeUpAssessment.updateMany({
    where: { id, schoolId, status: 'scheduled' },
    data: { status: 'completed', completedAt: new Date() },
  })
  if (updated.count !== 1)
    throw new MakeUpAssessmentStateError('Scheduled make-up required')
  return database.makeUpAssessment.findUniqueOrThrow({ where: { id } })
}
