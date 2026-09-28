import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const AssessmentParticipationInputSchema = z.strictObject({
  schoolId: z.uuid(),
  sessionId: z.uuid(),
  studentId: z.uuid(),
  status: z.enum(['present', 'absent', 'excused']),
})

export class AssessmentParticipationContextError extends Error {}

export async function recordAssessmentParticipation(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof AssessmentParticipationInputSchema>,
) {
  z.uuid().parse(actorId)
  const value = AssessmentParticipationInputSchema.parse(input)
  const session = await database.assessmentSession.findFirst({
    where: { id: value.sessionId, schoolId: value.schoolId, status: 'open' },
    include: { schedule: { select: { academicYearId: true } } },
  })
  if (!session)
    throw new AssessmentParticipationContextError('Open session required')
  const enrollment = await database.enrollment.findFirst({
    where: {
      schoolId: value.schoolId,
      academicYearId: session.schedule.academicYearId,
      schoolClassId: session.schoolClassId,
      studentId: value.studentId,
      status: 'approved',
    },
    select: { id: true },
  })
  if (!enrollment) {
    throw new AssessmentParticipationContextError(
      'Eligible enrollment required',
    )
  }
  try {
    return await database.assessmentParticipation.create({
      data: {
        schoolId: value.schoolId,
        sessionId: value.sessionId,
        studentId: value.studentId,
        enrollmentId: enrollment.id,
        academicYearId: session.schedule.academicYearId,
        schoolClassId: session.schoolClassId,
        status: value.status,
        recordedById: actorId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003'].includes(error.code)
    ) {
      throw new AssessmentParticipationContextError(
        'Participation already recorded or context changed',
      )
    }
    throw error
  }
}
