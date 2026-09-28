import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { effectiveMembershipWhere } from './membershipPeriods.js'
import { findSchoolMembership } from './schoolMemberships.js'

export const MeetingAvailabilitySchema = z
  .strictObject({
    schoolId: z.uuid(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    method: z.enum(['inPerson', 'phone', 'online']),
  })
  .refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
    path: ['endsAt'],
  })

export class MeetingAvailabilityError extends Error {}

export async function requireMeetingTeacher(
  database: PrismaClient,
  teacherId: string,
  schoolId: string,
) {
  const membership = await findSchoolMembership(database, teacherId, schoolId)
  const assignment = await database.teachingAssignment.findFirst({
    where: { userId: teacherId, schoolId, ...effectiveMembershipWhere() },
    select: { id: true },
  })
  if (membership?.role !== 'teacher' || !assignment)
    throw new MeetingAvailabilityError(
      'Current school teaching access required',
    )
}

export async function createMeetingAvailability(
  database: PrismaClient,
  teacherId: string,
  input: z.input<typeof MeetingAvailabilitySchema>,
) {
  const value = MeetingAvailabilitySchema.parse(input)
  await requireMeetingTeacher(database, teacherId, value.schoolId)
  const startsAt = new Date(value.startsAt)
  const endsAt = new Date(value.endsAt)
  if (startsAt <= new Date())
    throw new MeetingAvailabilityError('Future availability required')
  return database.$transaction(
    async (transaction) => {
      const overlap = await transaction.teacherMeetingAvailability.findFirst({
        where: {
          schoolId: value.schoolId,
          teacherId,
          active: true,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      })
      if (overlap) throw new MeetingAvailabilityError('Availability overlaps')
      return transaction.teacherMeetingAvailability.create({
        data: {
          schoolId: value.schoolId,
          teacherId,
          startsAt,
          endsAt,
          method: value.method,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function closeMeetingAvailability(
  database: PrismaClient,
  teacherId: string,
  schoolId: string,
  id: string,
) {
  await requireMeetingTeacher(database, teacherId, schoolId)
  const result = await database.teacherMeetingAvailability.updateMany({
    where: { id, schoolId, teacherId, active: true },
    data: { active: false },
  })
  if (result.count !== 1)
    throw new MeetingAvailabilityError('Availability not found')
}
