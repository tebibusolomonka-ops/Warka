import { Prisma, type PrismaClient } from '@prisma/client'

export type AssessmentScheduleIssueCode =
  | 'ASSESSMENT_CONTEXT'
  | 'ACADEMIC_DATE'
  | 'ROOM_INACTIVE'
  | 'ROOM_CAPACITY'
  | 'CLASS_COLLISION'
  | 'ROOM_COLLISION'

export type AssessmentScheduleIssue = {
  code: AssessmentScheduleIssueCode
  conflictingScheduleId?: string
}

export class AssessmentScheduleConflictError extends Error {
  constructor(readonly issues: AssessmentScheduleIssue[]) {
    super('Assessment schedule has blocking issues')
  }
}

type Candidate = {
  id: string
  schoolId: string
  academicYearId: string
  gradingPeriodId: string
  schoolClassId: string
  subjectId: string
  assessmentId: string
  roomId: string | null
  scheduledDate: Date
  startTime: string
  endTime: string
}

export async function validateAssessmentSchedule(
  database: PrismaClient | Prisma.TransactionClient,
  candidate: Candidate,
): Promise<AssessmentScheduleIssue[]> {
  const [assessment, year, period, room, eligibleCount, collisions] =
    await Promise.all([
      database.assessment.findFirst({
        where: {
          id: candidate.assessmentId,
          schoolId: candidate.schoolId,
          academicYearId: candidate.academicYearId,
          gradingPeriodId: candidate.gradingPeriodId,
          schoolClassId: candidate.schoolClassId,
          subjectId: candidate.subjectId,
        },
        select: { id: true },
      }),
      database.academicYear.findFirst({
        where: { id: candidate.academicYearId, schoolId: candidate.schoolId },
        select: { startsOn: true, endsOn: true },
      }),
      database.gradingPeriod.findFirst({
        where: {
          id: candidate.gradingPeriodId,
          schoolId: candidate.schoolId,
          academicYearId: candidate.academicYearId,
        },
        select: { startsOn: true, endsOn: true },
      }),
      candidate.roomId
        ? database.assessmentRoom.findFirst({
            where: { id: candidate.roomId, schoolId: candidate.schoolId },
            select: { active: true, capacity: true },
          })
        : Promise.resolve(null),
      database.enrollment.count({
        where: {
          schoolId: candidate.schoolId,
          academicYearId: candidate.academicYearId,
          schoolClassId: candidate.schoolClassId,
          status: 'approved',
        },
      }),
      database.assessmentSchedule.findMany({
        where: {
          schoolId: candidate.schoolId,
          id: { not: candidate.id },
          scheduledDate: candidate.scheduledDate,
          status: 'scheduled',
          startTime: { lt: candidate.endTime },
          endTime: { gt: candidate.startTime },
          OR: [
            { schoolClassId: candidate.schoolClassId },
            ...(candidate.roomId ? [{ roomId: candidate.roomId }] : []),
          ],
        },
        select: { id: true, schoolClassId: true, roomId: true },
      }),
    ])
  const issues: AssessmentScheduleIssue[] = []
  if (!assessment) issues.push({ code: 'ASSESSMENT_CONTEXT' })
  if (
    !year ||
    !period ||
    candidate.scheduledDate < year.startsOn ||
    candidate.scheduledDate > year.endsOn ||
    candidate.scheduledDate < period.startsOn ||
    candidate.scheduledDate > period.endsOn
  ) {
    issues.push({ code: 'ACADEMIC_DATE' })
  }
  if (candidate.roomId && (!room || !room.active)) {
    issues.push({ code: 'ROOM_INACTIVE' })
  } else if (room?.capacity && eligibleCount > room.capacity) {
    issues.push({ code: 'ROOM_CAPACITY' })
  }
  for (const collision of collisions) {
    if (collision.schoolClassId === candidate.schoolClassId) {
      issues.push({
        code: 'CLASS_COLLISION',
        conflictingScheduleId: collision.id,
      })
    }
    if (candidate.roomId && collision.roomId === candidate.roomId) {
      issues.push({
        code: 'ROOM_COLLISION',
        conflictingScheduleId: collision.id,
      })
    }
  }
  return issues
}

export async function scheduleAssessment(
  database: PrismaClient,
  schoolId: string,
  id: string,
) {
  try {
    return await database.$transaction(
      async (transaction) => {
        const candidate = await transaction.assessmentSchedule.findFirst({
          where: { id, schoolId, status: 'draft' },
        })
        if (!candidate)
          throw new AssessmentScheduleConflictError([
            { code: 'ASSESSMENT_CONTEXT' },
          ])
        const issues = await validateAssessmentSchedule(transaction, candidate)
        if (issues.length) throw new AssessmentScheduleConflictError(issues)
        return transaction.assessmentSchedule.update({
          where: { id_schoolId: { id, schoolId } },
          data: { status: 'scheduled' },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new AssessmentScheduleConflictError([{ code: 'CLASS_COLLISION' }])
    }
    throw error
  }
}
