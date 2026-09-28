import type { PrismaClient } from '@prisma/client'

export class AttendancePermissionError extends Error {
  constructor() {
    super('User cannot manage attendance for this class')
  }
}

export type AttendanceScope = {
  schoolId: string
  academicYearId: string
  schoolClassId: string
  subjectId?: string | null
  teachingAssignmentId?: string | null
}

export async function mayManageAttendance(
  database: PrismaClient,
  actorId: string,
  scope: AttendanceScope,
  at: Date,
): Promise<boolean> {
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId: scope.schoolId } },
  })
  if (
    !membership ||
    membership.startsAt > at ||
    (membership.endsAt && membership.endsAt <= at)
  )
    return false
  if (membership.role === 'administrator') return true
  if (membership.role !== 'teacher') return false
  return Boolean(
    await database.teachingAssignment.findFirst({
      where: {
        id: scope.teachingAssignmentId ?? undefined,
        userId: actorId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        schoolClassId: scope.schoolClassId,
        subjectId: scope.subjectId ?? undefined,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gt: at } }],
      },
      select: { id: true },
    }),
  )
}

export async function assertAttendanceManager(
  database: PrismaClient,
  actorId: string,
  scope: AttendanceScope,
  at: Date,
) {
  if (!(await mayManageAttendance(database, actorId, scope, at)))
    throw new AttendancePermissionError()
}
