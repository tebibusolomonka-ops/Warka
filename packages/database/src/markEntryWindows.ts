import type { Assessment, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { findSchoolMembership } from './schoolMemberships.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'

export const MarkEntryWindowInputSchema = z
  .strictObject({
    schoolId: z.uuid(),
    assessmentId: z.uuid(),
    opensAt: z.iso.datetime({ offset: true }),
    closesAt: z.iso.datetime({ offset: true }),
  })
  .refine((value) => new Date(value.opensAt) < new Date(value.closesAt), {
    path: ['closesAt'],
  })

export const MarkEntryOverrideReasonSchema = z.string().trim().min(5).max(200)

export class MarkEntryWindowStateError extends Error {}

export async function createMarkEntryWindow(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof MarkEntryWindowInputSchema>,
) {
  const value = MarkEntryWindowInputSchema.parse(input)
  await requireAcademicYearAdmin(database, actorId, value.schoolId)
  const assessment = await database.assessment.findFirst({
    where: { id: value.assessmentId, schoolId: value.schoolId },
    select: { academicYearId: true, gradingPeriodId: true },
  })
  if (!assessment) throw new MarkEntryWindowStateError('Assessment not found')
  return database.markEntryWindow.create({
    data: {
      schoolId: value.schoolId,
      academicYearId: assessment.academicYearId,
      gradingPeriodId: assessment.gradingPeriodId,
      assessmentId: value.assessmentId,
      opensAt: new Date(value.opensAt),
      closesAt: new Date(value.closesAt),
      createdById: actorId,
    },
  })
}

export async function transitionMarkEntryWindow(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  id: string,
  action: 'open' | 'close',
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const updated = await database.markEntryWindow.updateMany({
    where: { id, schoolId, status: action === 'open' ? 'scheduled' : 'open' },
    data: { status: action === 'open' ? 'open' : 'closed' },
  })
  if (updated.count !== 1)
    throw new MarkEntryWindowStateError('Window state changed')
  return database.markEntryWindow.findUniqueOrThrow({ where: { id } })
}

export async function assertMarkEntryWindow(
  database: PrismaClient,
  actorId: string,
  assessment: Assessment,
  overrideReason?: string,
  now = new Date(),
): Promise<boolean> {
  const window = await database.markEntryWindow.findUnique({
    where: { assessmentId: assessment.id },
  })
  if (
    !window ||
    (window.status === 'open' && window.opensAt <= now && window.closesAt > now)
  ) {
    if (overrideReason)
      throw new MarkEntryWindowStateError('Override is not needed')
    return false
  }
  if (!overrideReason)
    throw new MarkEntryWindowStateError('Mark-entry window is closed')
  MarkEntryOverrideReasonSchema.parse(overrideReason)
  const school = await database.school.findUnique({
    where: { id: assessment.schoolId },
    select: { organizationId: true },
  })
  const membership = await findSchoolMembership(
    database,
    actorId,
    assessment.schoolId,
  )
  if (
    !school ||
    (!(await hasOrganizationAdminRole(
      database,
      actorId,
      school.organizationId,
    )) &&
      membership?.role !== 'administrator' &&
      membership?.role !== 'approver')
  ) {
    throw new MarkEntryWindowStateError(
      'Authorized reviewer required for override',
    )
  }
  return true
}
