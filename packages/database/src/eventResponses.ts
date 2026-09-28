import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { mayViewSchoolEvent } from './eventAudiences.js'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'
import { findSchoolMembership } from './schoolMemberships.js'
import { requireSchoolEventManager } from './schoolEvents.js'

export const EventResponseStatusSchema = z.enum(['going', 'notGoing'])
export class EventResponseError extends Error {}

export async function setEventRsvpEnabled(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  eventId: string,
  enabled: boolean,
) {
  await requireSchoolEventManager(database, actorId, schoolId)
  const changed = await database.schoolEvent.updateMany({
    where: { id: eventId, schoolId, status: 'draft' },
    data: { rsvpEnabled: enabled },
  })
  if (changed.count !== 1) throw new EventResponseError('Draft event required')
  return database.schoolEvent.findUniqueOrThrow({ where: { id: eventId } })
}

export async function respondToSchoolEvent(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  eventId: string,
  status: 'going' | 'notGoing',
  guardianStudentId?: string,
) {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  z.uuid().parse(eventId)
  const value = EventResponseStatusSchema.parse(status)
  const event = await database.schoolEvent.findFirst({
    where: { id: eventId, schoolId, status: 'published', rsvpEnabled: true },
    select: { id: true },
  })
  if (!event) throw new EventResponseError('RSVP is unavailable')
  let studentId: string | null = null
  let subjectKey = 'self'
  if (guardianStudentId) {
    const access = await database.guardianAccess.findUnique({
      where: { userId: actorId },
    })
    if (
      !access ||
      !(await hasActiveVerifiedGuardianRelationship(
        database,
        schoolId,
        guardianStudentId,
        access.guardianId,
      ))
    )
      throw new EventResponseError('Verified linked child required')
    studentId = guardianStudentId
    subjectKey = `child:${guardianStudentId}`
  } else {
    const student = await database.studentAccess.findUnique({
      where: { userId: actorId },
    })
    if (student) studentId = student.studentId
    else if (!(await findSchoolMembership(database, actorId, schoolId)))
      throw new EventResponseError('Student or school staff access required')
  }
  if (
    !(await mayViewSchoolEvent(
      database,
      actorId,
      schoolId,
      eventId,
      guardianStudentId,
    ))
  )
    throw new EventResponseError('Event audience unavailable')
  return database.$transaction(
    async (transaction) => {
      const prior = await transaction.eventResponse.findUnique({
        where: {
          eventId_respondentUserId_subjectKey: {
            eventId,
            respondentUserId: actorId,
            subjectKey,
          },
        },
      })
      if (prior?.status === value) return prior
      const current = prior
        ? await transaction.eventResponse.update({
            where: { id: prior.id },
            data: { status: value },
          })
        : await transaction.eventResponse.create({
            data: {
              eventId,
              schoolId,
              respondentUserId: actorId,
              subjectKey,
              studentId,
              status: value,
            },
          })
      await transaction.eventResponseHistory.create({
        data: {
          responseId: current.id,
          actorId,
          previousStatus: prior?.status ?? null,
          newStatus: value,
        },
      })
      return current
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function eventResponseCounts(
  database: PrismaClient,
  schoolId: string,
  eventId: string,
) {
  const rows = await database.eventResponse.groupBy({
    by: ['status'],
    where: { schoolId, eventId },
    _count: { _all: true },
  })
  return {
    going: rows.find((row) => row.status === 'going')?._count._all ?? 0,
    notGoing: rows.find((row) => row.status === 'notGoing')?._count._all ?? 0,
  }
}
