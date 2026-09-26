import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'

export const ManualChecklistKeySchema = z.enum([
  'backupContactConfirmed',
  'staffOrientationConfirmed',
])
export const ManualChecklistStatusSchema = z.enum([
  'pending',
  'complete',
  'notApplicable',
])

export function derivedChecklist(
  counts: Record<
    | 'documentProfile'
    | 'administrator'
    | 'academicYear'
    | 'gradeLevels'
    | 'classes'
    | 'subjects'
    | 'gradingScheme'
    | 'staffAssignments',
    number
  >,
) {
  return Object.entries(counts).map(([key, count]) => ({
    key,
    source: 'system' as const,
    status: count > 0 ? ('complete' as const) : ('pending' as const),
    completedAt: null,
    completedById: null,
  }))
}

export async function listOnboardingChecklist(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const [
    documentProfile,
    administrator,
    academicYear,
    gradeLevels,
    classes,
    subjects,
    gradingScheme,
    staffAssignments,
    onboarding,
  ] = await Promise.all([
    database.schoolDocumentProfile.count({ where: { schoolId } }),
    database.schoolMembership.count({
      where: { schoolId, role: 'administrator' },
    }),
    database.academicYear.count({ where: { schoolId } }),
    database.gradeLevel.count({ where: { schoolId } }),
    database.schoolClass.count({ where: { schoolId } }),
    database.subject.count({ where: { schoolId } }),
    database.gradingScheme.count({ where: { schoolId } }),
    database.teachingAssignment.count({ where: { schoolId } }),
    database.schoolOnboarding.findUnique({
      where: { schoolId },
      include: { checklistItems: true },
    }),
  ])
  const system = derivedChecklist({
    documentProfile,
    administrator,
    academicYear,
    gradeLevels,
    classes,
    subjects,
    gradingScheme,
    staffAssignments,
  })
  const manual = ManualChecklistKeySchema.options.map((key) => {
    const item = onboarding?.checklistItems.find((row) => row.key === key)
    return {
      key,
      source: 'manual' as const,
      status: item?.status ?? 'pending',
      completedAt: item?.completedAt ?? null,
      completedById: item?.completedById ?? null,
    }
  })
  return [...system, ...manual]
}

export async function updateManualChecklistItem(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  key: string,
  status: string,
  now = new Date(),
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const parsedKey = ManualChecklistKeySchema.parse(key)
  const parsedStatus = ManualChecklistStatusSchema.parse(status)
  const onboarding = await database.schoolOnboarding.findUnique({
    where: { schoolId },
  })
  if (!onboarding || onboarding.status !== 'inProgress')
    throw new Error('Onboarding must be in progress')
  return database.onboardingChecklistItem.upsert({
    where: {
      onboardingId_key: { onboardingId: onboarding.id, key: parsedKey },
    },
    create: {
      onboardingId: onboarding.id,
      key: parsedKey,
      status: parsedStatus,
      completedAt: parsedStatus === 'complete' ? now : null,
      completedById: parsedStatus === 'complete' ? actorId : null,
    },
    update: {
      status: parsedStatus,
      completedAt: parsedStatus === 'complete' ? now : null,
      completedById: parsedStatus === 'complete' ? actorId : null,
    },
  })
}
