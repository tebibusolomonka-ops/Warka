import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { effectiveMembershipWhere } from './membershipPeriods.js'
import { findGuardianAccessForUser } from './guardianAccess.js'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'
import { findSchoolMembership } from './schoolMemberships.js'

export const MeetingRequestSchema = z.strictObject({
  schoolId: z.uuid(),
  studentId: z.uuid(),
  teachingAssignmentId: z.uuid(),
  topic: z
    .string()
    .trim()
    .min(3)
    .max(300)
    .refine((value) => !/[<>]/.test(value)),
})

export class FamilyMeetingAccessError extends Error {}

export async function requestFamilyMeeting(
  database: PrismaClient,
  guardianUserId: string,
  input: z.input<typeof MeetingRequestSchema>,
) {
  const value = MeetingRequestSchema.parse(input)
  const access = await findGuardianAccessForUser(database, guardianUserId)
  if (
    !access ||
    !(await hasActiveVerifiedGuardianRelationship(
      database,
      value.schoolId,
      value.studentId,
      access.guardianId,
    ))
  )
    throw new FamilyMeetingAccessError('Meeting relationship unavailable')
  const enrollment = await database.enrollment.findFirst({
    where: {
      schoolId: value.schoolId,
      studentId: value.studentId,
      status: 'approved',
      withdrawnAt: null,
      schoolClassId: { not: null },
    },
    orderBy: { approvedAt: 'desc' },
  })
  const assignment =
    enrollment &&
    (await database.teachingAssignment.findFirst({
      where: {
        id: value.teachingAssignmentId,
        schoolId: value.schoolId,
        academicYearId: enrollment.academicYearId,
        schoolClassId: enrollment.schoolClassId!,
        ...effectiveMembershipWhere(),
      },
    }))
  if (
    !assignment ||
    (await findSchoolMembership(database, assignment.userId, value.schoolId))
      ?.role !== 'teacher'
  )
    throw new FamilyMeetingAccessError('Teacher assignment unavailable')
  return database.parentTeacherMeetingRequest.create({
    data: {
      schoolId: value.schoolId,
      studentId: value.studentId,
      guardianId: access.guardianId,
      guardianUserId,
      teacherId: assignment.userId,
      teachingAssignmentId: assignment.id,
      topic: value.topic,
    },
  })
}
