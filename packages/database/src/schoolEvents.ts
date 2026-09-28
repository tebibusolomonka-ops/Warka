import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findSchoolMembership } from './schoolMemberships.js'

const plain = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[<>]/.test(value))
export const SchoolEventInputSchema = z
  .strictObject({
    schoolId: z.uuid(),
    title: plain(200),
    description: plain(5000),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    schoolLocation: plain(200).optional(),
  })
  .refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
    path: ['endsAt'],
  })

export class SchoolEventAccessError extends Error {}
export class SchoolEventStateError extends Error {}

export async function requireSchoolEventManager(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const membership = await findSchoolMembership(database, actorId, schoolId)
  if (membership?.role !== 'administrator')
    throw new SchoolEventAccessError('School event administration required')
}

export async function createSchoolEvent(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof SchoolEventInputSchema>,
) {
  const value = SchoolEventInputSchema.parse(input)
  await requireSchoolEventManager(database, actorId, value.schoolId)
  return database.schoolEvent.create({
    data: {
      schoolId: value.schoolId,
      createdById: actorId,
      title: value.title,
      description: value.description,
      startsAt: new Date(value.startsAt),
      endsAt: new Date(value.endsAt),
      schoolLocation: value.schoolLocation ?? null,
    },
  })
}

export async function editDraftSchoolEvent(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  id: string,
  input: Omit<z.input<typeof SchoolEventInputSchema>, 'schoolId'>,
) {
  const value = SchoolEventInputSchema.parse({ ...input, schoolId })
  await requireSchoolEventManager(database, actorId, schoolId)
  const updated = await database.schoolEvent.updateMany({
    where: { id, schoolId, status: 'draft' },
    data: {
      title: value.title,
      description: value.description,
      startsAt: new Date(value.startsAt),
      endsAt: new Date(value.endsAt),
      schoolLocation: value.schoolLocation ?? null,
    },
  })
  if (updated.count !== 1)
    throw new SchoolEventStateError('Draft event required')
  return database.schoolEvent.findUniqueOrThrow({ where: { id } })
}

export async function transitionSchoolEvent(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  id: string,
  action: 'publish' | 'cancel' | 'complete',
) {
  await requireSchoolEventManager(database, actorId, schoolId)
  if (
    action === 'publish' &&
    !(await database.schoolEventAudience.findUnique({ where: { eventId: id } }))
  )
    throw new SchoolEventStateError(
      'Event audience required before publication',
    )
  if (action === 'publish') {
    const attachments = await database.eventAttachment.findMany({
      where: { eventId: id, schoolId, removedAt: null },
      include: {
        fileAsset: {
          include: {
            scans: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
            },
          },
        },
      },
    })
    if (
      attachments.some(
        ({ fileAsset }) =>
          fileAsset.status !== 'available' ||
          fileAsset.scans[0]?.result !== 'clean',
      )
    )
      throw new SchoolEventStateError('Event attachments must pass scanning')
  }
  const previous = action === 'publish' ? 'draft' : 'published'
  const status =
    action === 'publish'
      ? 'published'
      : action === 'cancel'
        ? 'cancelled'
        : 'completed'
  const now = new Date()
  const changed = await database.schoolEvent.updateMany({
    where: { id, schoolId, status: previous },
    data: {
      status,
      ...(action === 'publish'
        ? { publishedAt: now }
        : action === 'cancel'
          ? { cancelledAt: now }
          : { completedAt: now }),
    },
  })
  if (changed.count !== 1)
    throw new SchoolEventStateError('Event state changed')
  return database.schoolEvent.findUniqueOrThrow({ where: { id } })
}
