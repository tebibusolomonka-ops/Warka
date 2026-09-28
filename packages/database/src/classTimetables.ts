import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { validateSchoolTimetable } from './timetableValidation.js'

export class ClassTimetableStateError extends Error {}
export class ClassTimetableBlockedError extends Error {
  constructor(
    readonly problems: Awaited<ReturnType<typeof validateSchoolTimetable>>,
  ) {
    super('Timetable has blocking conflicts')
  }
}

export async function createClassTimetableDraft(
  database: PrismaClient,
  input: { schoolId: string; academicYearId: string; schoolClassId: string },
) {
  const value = z
    .strictObject({
      schoolId: z.uuid(),
      academicYearId: z.uuid(),
      schoolClassId: z.uuid(),
    })
    .parse(input)
  try {
    return await database.classTimetable.create({ data: value })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003'].includes(error.code)
    )
      throw new ClassTimetableStateError(
        'Draft already exists or class scope is invalid',
      )
    throw error
  }
}

export async function publishClassTimetable(
  database: PrismaClient,
  actorId: string,
  timetableId: string,
  now = new Date(),
) {
  z.uuid().parse(actorId)
  z.uuid().parse(timetableId)
  return database.$transaction(
    async (transaction) => {
      const plan = await transaction.classTimetable.findUnique({
        where: { id: timetableId },
      })
      if (!plan || plan.status !== 'draft')
        throw new ClassTimetableStateError('Draft timetable required')
      const count = await transaction.classTimetableEntry.count({
        where: { timetableId },
      })
      if (!count) throw new ClassTimetableStateError('Timetable has no entries')
      const problems = await validateSchoolTimetable(
        transaction,
        timetableId,
        now,
      )
      if (problems.length) throw new ClassTimetableBlockedError(problems)
      const previous = await transaction.classTimetable.findFirst({
        where: {
          schoolId: plan.schoolId,
          academicYearId: plan.academicYearId,
          schoolClassId: plan.schoolClassId,
          status: 'published',
        },
      })
      if (previous) {
        await transaction.classTimetable.update({
          where: { id: previous.id },
          data: { status: 'archived', archivedAt: now },
        })
        await recordAuditEvent(transaction, {
          schoolId: plan.schoolId,
          actorUserId: actorId,
          action: 'timetable.archived',
          resourceType: 'classTimetable',
          resourceId: previous.id,
        })
      }
      const published = await transaction.classTimetable.update({
        where: { id: plan.id },
        data: { status: 'published', publishedAt: now },
      })
      await recordAuditEvent(transaction, {
        schoolId: plan.schoolId,
        actorUserId: actorId,
        action: 'timetable.published',
        resourceType: 'classTimetable',
        resourceId: plan.id,
      })
      return published
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function archiveClassTimetable(
  database: PrismaClient,
  actorId: string,
  timetableId: string,
  now = new Date(),
) {
  z.uuid().parse(actorId)
  z.uuid().parse(timetableId)
  return database.$transaction(
    async (transaction) => {
      const plan = await transaction.classTimetable.findUnique({
        where: { id: timetableId },
      })
      if (!plan || plan.status === 'archived')
        throw new ClassTimetableStateError('Active timetable required')
      const archived = await transaction.classTimetable.update({
        where: { id: timetableId },
        data: { status: 'archived', archivedAt: now },
      })
      await recordAuditEvent(transaction, {
        schoolId: plan.schoolId,
        actorUserId: actorId,
        action: 'timetable.archived',
        resourceType: 'classTimetable',
        resourceId: timetableId,
      })
      return archived
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function listClassTimetables(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
) {
  return database.classTimetable.findMany({
    where: { schoolId, academicYearId, schoolClassId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}
