import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { effectiveMembershipWhere } from './membershipPeriods.js'
import { requireBureauPermission } from './bureauAccess.js'

const NoteBody = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => !/<\/?[a-z][^>]*>/i.test(value),
    'Reporting notes must be plain text',
  )

export class ReportingNoteAccessDenied extends Error {}

async function schoolSubmission(
  database: PrismaClient,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
) {
  const membership = await database.schoolMembership.findUnique({
    where: {
      ...effectiveMembershipWhere(),
      userId_schoolId: { userId: actorUserId, schoolId },
    },
  })
  if (!membership || !['administrator', 'registrar'].includes(membership.role))
    throw new ReportingNoteAccessDenied('School reporting permission denied')
  return database.reportingSubmission.findUniqueOrThrow({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
  })
}

async function bureauSubmission(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  submissionId: string,
  permission: 'view' | 'manage',
) {
  const submission = await database.reportingSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { reportingPeriod: true },
  })
  if (submission.reportingPeriod.organizationId !== organizationId)
    throw new ReportingNoteAccessDenied('Reporting scope mismatch')
  await requireBureauPermission(
    database,
    actorUserId,
    organizationId,
    permission,
  )
  return submission
}

function requireVersion(version: number) {
  if (version < 1)
    throw new ReportingNoteAccessDenied('No submitted version exists')
  return version
}

export async function addSchoolReportingNote(
  database: PrismaClient,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
  body: string,
) {
  const submission = await schoolSubmission(
    database,
    actorUserId,
    reportingPeriodId,
    schoolId,
  )
  return database.reportingReviewNote.create({
    data: {
      submissionId: submission.id,
      version: requireVersion(submission.currentVersion),
      authorUserId: actorUserId,
      visibility: 'schoolAndBureau',
      body: NoteBody.parse(body),
    },
  })
}

export async function addBureauReportingNote(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  submissionId: string,
  visibility: 'schoolAndBureau' | 'bureauInternal',
  body: string,
) {
  const submission = await bureauSubmission(
    database,
    actorUserId,
    organizationId,
    submissionId,
    'manage',
  )
  return database.reportingReviewNote.create({
    data: {
      submissionId,
      version: requireVersion(submission.currentVersion),
      authorUserId: actorUserId,
      visibility,
      body: NoteBody.parse(body),
    },
  })
}

export async function listSchoolReportingNotes(
  database: PrismaClient,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
) {
  const submission = await schoolSubmission(
    database,
    actorUserId,
    reportingPeriodId,
    schoolId,
  )
  return database.reportingReviewNote.findMany({
    where: { submissionId: submission.id, visibility: 'schoolAndBureau' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 100,
    include: { authorUser: { select: { displayName: true } } },
  })
}

export async function listBureauReportingNotes(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  submissionId: string,
) {
  await bureauSubmission(
    database,
    actorUserId,
    organizationId,
    submissionId,
    'view',
  )
  return database.reportingReviewNote.findMany({
    where: { submissionId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 100,
    include: { authorUser: { select: { displayName: true } } },
  })
}
