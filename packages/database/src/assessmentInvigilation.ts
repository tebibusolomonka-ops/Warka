import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export class AssessmentInvigilationError extends Error {}

export async function assignAssessmentInvigilator(
  database: PrismaClient,
  schoolId: string,
  sessionId: string,
  userId: string,
  assignedById: string,
  now = new Date(),
) {
  for (const id of [schoolId, sessionId, userId, assignedById])
    z.uuid().parse(id)
  try {
    return await database.$transaction(
      async (transaction) => {
        const [session, membership, user] = await Promise.all([
          transaction.assessmentSession.findFirst({
            where: {
              id: sessionId,
              schoolId,
              status: { in: ['planned', 'open'] },
            },
            include: { schedule: { select: { status: true } } },
          }),
          transaction.schoolMembership.findUnique({
            where: { userId_schoolId: { userId, schoolId } },
          }),
          transaction.user.findUnique({
            where: { id: userId },
            select: { accountStatus: true },
          }),
        ])
        if (!session || session.schedule.status !== 'scheduled') {
          throw new AssessmentInvigilationError(
            'Scheduled assessment session required',
          )
        }
        const assignmentTime = new Date(
          `${session.sessionDate.toISOString().slice(0, 10)}T${session.startTime}:00.000Z`,
        )
        if (
          !user ||
          user.accountStatus !== 'active' ||
          !membership ||
          membership.startsAt > now ||
          membership.startsAt > assignmentTime ||
          (membership.endsAt &&
            (membership.endsAt <= now || membership.endsAt <= assignmentTime))
        ) {
          throw new AssessmentInvigilationError(
            'Active school staff access required',
          )
        }
        const collision = await transaction.assessmentInvigilation.findFirst({
          where: {
            userId,
            sessionId: { not: sessionId },
            session: {
              sessionDate: session.sessionDate,
              status: { in: ['planned', 'open'] },
              startTime: { lt: session.endTime },
              endTime: { gt: session.startTime },
            },
          },
          select: { id: true },
        })
        if (collision)
          throw new AssessmentInvigilationError('Invigilator is double booked')
        return transaction.assessmentInvigilation.create({
          data: { schoolId, sessionId, userId, assignedById },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003', 'P2034'].includes(error.code)
    ) {
      throw new AssessmentInvigilationError('Invigilator assignment conflicts')
    }
    throw error
  }
}
