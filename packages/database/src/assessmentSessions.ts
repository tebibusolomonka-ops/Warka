import { Prisma, type PrismaClient } from '@prisma/client'
import { validateAssessmentSchedule } from './assessmentScheduleValidation.js'

export class AssessmentSessionStateError extends Error {}

export async function createAssessmentSession(
  database: PrismaClient,
  schoolId: string,
  scheduleId: string,
) {
  const schedule = await database.assessmentSchedule.findFirst({
    where: { id: scheduleId, schoolId, status: 'scheduled' },
  })
  if (!schedule)
    throw new AssessmentSessionStateError('Scheduled assessment required')
  try {
    return await database.assessmentSession.create({
      data: {
        schoolId,
        scheduleId,
        schoolClassId: schedule.schoolClassId,
        sessionDate: schedule.scheduledDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AssessmentSessionStateError('Session already exists')
    }
    throw error
  }
}

export async function openAssessmentSession(
  database: PrismaClient,
  schoolId: string,
  sessionId: string,
) {
  return database.$transaction(async (transaction) => {
    const session = await transaction.assessmentSession.findFirst({
      where: { id: sessionId, schoolId, status: 'planned' },
      include: { schedule: true },
    })
    if (!session || session.schedule.status !== 'scheduled') {
      throw new AssessmentSessionStateError(
        'Planned session with scheduled assessment required',
      )
    }
    const issues = await validateAssessmentSchedule(
      transaction,
      session.schedule,
    )
    if (issues.length)
      throw new AssessmentSessionStateError(
        `Schedule has blocking issues: ${issues.map((issue) => issue.code).join(', ')}`,
      )
    const updated = await transaction.assessmentSession.updateMany({
      where: { id: sessionId, schoolId, status: 'planned' },
      data: { status: 'open', openedAt: new Date() },
    })
    if (updated.count !== 1)
      throw new AssessmentSessionStateError('Session state changed')
    return transaction.assessmentSession.findUniqueOrThrow({
      where: { id: sessionId },
    })
  })
}

export async function completeAssessmentSession(
  database: PrismaClient,
  schoolId: string,
  sessionId: string,
) {
  const updated = await database.assessmentSession.updateMany({
    where: { id: sessionId, schoolId, status: 'open' },
    data: { status: 'completed', completedAt: new Date() },
  })
  if (updated.count !== 1)
    throw new AssessmentSessionStateError('Open session required')
  return database.assessmentSession.findUniqueOrThrow({
    where: { id: sessionId },
  })
}
