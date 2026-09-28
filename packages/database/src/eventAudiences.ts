import type { PrismaClient, SchoolEventAudienceScope } from '@prisma/client'
import { z } from 'zod'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'
import { findSchoolMembership } from './schoolMemberships.js'
import {
  requireSchoolEventManager,
  SchoolEventStateError,
} from './schoolEvents.js'

export const EventAudienceSchema = z.discriminatedUnion('scope', [
  z.strictObject({ scope: z.literal('wholeSchool') }),
  z.strictObject({ scope: z.literal('students') }),
  z.strictObject({ scope: z.literal('guardians') }),
  z.strictObject({ scope: z.literal('staff') }),
  z.strictObject({ scope: z.literal('grade'), gradeLevelId: z.uuid() }),
  z.strictObject({ scope: z.literal('class'), schoolClassId: z.uuid() }),
])

export async function setSchoolEventAudience(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  eventId: string,
  input: z.input<typeof EventAudienceSchema>,
) {
  const value = EventAudienceSchema.parse(input)
  await requireSchoolEventManager(database, actorId, schoolId)
  const event = await database.schoolEvent.findFirst({
    where: { id: eventId, schoolId, status: 'draft' },
  })
  if (!event) throw new SchoolEventStateError('Draft event required')
  if (
    value.scope === 'grade' &&
    !(await database.gradeLevel.findFirst({
      where: { id: value.gradeLevelId, schoolId },
    }))
  )
    throw new SchoolEventStateError('Grade is outside this school')
  if (
    value.scope === 'class' &&
    !(await database.schoolClass.findFirst({
      where: { id: value.schoolClassId, schoolId },
    }))
  )
    throw new SchoolEventStateError('Class is outside this school')
  return database.schoolEventAudience.upsert({
    where: { eventId },
    create: {
      eventId,
      schoolId,
      scope: value.scope,
      gradeLevelId: value.scope === 'grade' ? value.gradeLevelId : null,
      schoolClassId: value.scope === 'class' ? value.schoolClassId : null,
    },
    update: {
      scope: value.scope,
      gradeLevelId: value.scope === 'grade' ? value.gradeLevelId : null,
      schoolClassId: value.scope === 'class' ? value.schoolClassId : null,
    },
  })
}

function eligible(
  scope: SchoolEventAudienceScope,
  role: 'student' | 'guardian' | 'staff',
  gradeLevelId: string | null,
  schoolClassId: string | null,
  audience: { gradeLevelId: string | null; schoolClassId: string | null },
) {
  if (scope === 'wholeSchool') return true
  if (scope === 'staff') return role === 'staff'
  if (scope === 'students') return role === 'student'
  if (scope === 'guardians') return role === 'guardian'
  if (role === 'staff') return false
  if (scope === 'grade') return gradeLevelId === audience.gradeLevelId
  return schoolClassId === audience.schoolClassId
}

export async function mayViewSchoolEvent(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  eventId: string,
  guardianStudentId?: string,
) {
  const day = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const event = await database.schoolEvent.findFirst({
    where: {
      id: eventId,
      schoolId,
      status: { in: ['published', 'completed'] },
    },
    include: { audience: true },
  })
  if (!event?.audience) return false
  const membership = await findSchoolMembership(database, actorId, schoolId)
  if (
    membership &&
    eligible(event.audience.scope, 'staff', null, null, event.audience)
  )
    return true
  const studentAccess = await database.studentAccess.findUnique({
    where: { userId: actorId },
  })
  if (studentAccess) {
    const enrollment = await database.enrollment.findFirst({
      where: {
        schoolId,
        studentId: studentAccess.studentId,
        status: 'approved',
        withdrawnAt: null,
        academicYear: {
          startsOn: { lte: day },
          endsOn: { gte: day },
        },
      },
    })
    if (
      enrollment &&
      eligible(
        event.audience.scope,
        'student',
        enrollment.gradeLevelId,
        enrollment.schoolClassId,
        event.audience,
      )
    )
      return true
  }
  const guardianAccess = await database.guardianAccess.findUnique({
    where: { userId: actorId },
  })
  if (
    guardianAccess &&
    guardianStudentId &&
    (await hasActiveVerifiedGuardianRelationship(
      database,
      schoolId,
      guardianStudentId,
      guardianAccess.guardianId,
    ))
  ) {
    const enrollment = await database.enrollment.findFirst({
      where: {
        schoolId,
        studentId: guardianStudentId,
        status: 'approved',
        withdrawnAt: null,
        academicYear: {
          startsOn: { lte: day },
          endsOn: { gte: day },
        },
      },
    })
    if (
      enrollment &&
      eligible(
        event.audience.scope,
        'guardian',
        enrollment.gradeLevelId,
        enrollment.schoolClassId,
        event.audience,
      )
    )
      return true
  }
  return false
}
