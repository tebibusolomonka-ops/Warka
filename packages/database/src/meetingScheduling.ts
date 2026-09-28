import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { eligibleCourseworkEnrollment } from './courseworkAudience.js'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'
import { requireMeetingTeacher } from './meetingAvailability.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'

export const ScheduleFamilyMeetingSchema = z.strictObject({
  schoolId: z.uuid(),
  requestId: z.uuid(),
  availabilityId: z.uuid(),
  schoolLocation: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !/[<>]/.test(value))
    .optional(),
})

export class MeetingSchedulingError extends Error {}

export async function scheduleFamilyMeeting(
  database: PrismaClient,
  teacherId: string,
  input: z.input<typeof ScheduleFamilyMeetingSchema>,
) {
  const value = ScheduleFamilyMeetingSchema.parse(input)
  await requireMeetingTeacher(database, teacherId, value.schoolId)
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.parentTeacherMeetingRequest.findFirst({
        where: {
          id: value.requestId,
          schoolId: value.schoolId,
          teacherId,
          status: { in: ['requested', 'scheduled'] },
        },
      })
      if (!request)
        throw new MeetingSchedulingError('Pending meeting request required')
      const relationship = await hasActiveVerifiedGuardianRelationship(
        transaction as PrismaClient,
        request.schoolId,
        request.studentId,
        request.guardianId,
      )
      const assignment = await transaction.teachingAssignment.findFirst({
        where: {
          id: request.teachingAssignmentId,
          userId: teacherId,
          schoolId: value.schoolId,
          ...effectiveMembershipWhere(),
        },
      })
      const enrollment =
        assignment &&
        (await eligibleCourseworkEnrollment(
          transaction as PrismaClient,
          request.studentId,
          assignment,
        ))
      if (!relationship || !assignment || !enrollment)
        throw new MeetingSchedulingError('Meeting relationship changed')
      const slot = await transaction.teacherMeetingAvailability.findFirst({
        where: {
          id: value.availabilityId,
          schoolId: value.schoolId,
          teacherId,
          active: true,
          startsAt: { gt: new Date() },
        },
      })
      if (!slot)
        throw new MeetingSchedulingError(
          'Available school meeting window required',
        )
      const overlap = await transaction.parentTeacherMeetingRequest.findFirst({
        where: {
          schoolId: value.schoolId,
          teacherId,
          status: 'scheduled',
          id: { not: request.id },
          scheduledStartAt: { lt: slot.endsAt },
          scheduledEndAt: { gt: slot.startsAt },
        },
        select: { id: true },
      })
      if (overlap) throw new MeetingSchedulingError('Teacher is already booked')
      if (slot.method === 'inPerson' && !value.schoolLocation)
        throw new MeetingSchedulingError('School location label required')
      if (slot.method !== 'inPerson' && value.schoolLocation)
        throw new MeetingSchedulingError(
          'Location only applies to school meetings',
        )
      const scheduled = await transaction.parentTeacherMeetingRequest.update({
        where: { id: request.id },
        data: {
          status: 'scheduled',
          scheduledStartAt: slot.startsAt,
          scheduledEndAt: slot.endsAt,
          meetingMethod: slot.method,
          schoolLocation: value.schoolLocation ?? null,
        },
      })
      await transaction.meetingEvent.create({
        data: {
          requestId: request.id,
          actorId: teacherId,
          kind: request.status === 'scheduled' ? 'rescheduled' : 'scheduled',
          previousStartAt: request.scheduledStartAt,
          previousEndAt: request.scheduledEndAt,
          newStartAt: slot.startsAt,
          newEndAt: slot.endsAt,
        },
      })
      return scheduled
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
