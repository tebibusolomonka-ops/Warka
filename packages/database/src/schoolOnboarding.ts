import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { recordAuditEvent } from './auditEvents.js'

export class SchoolOnboardingStateError extends Error {
  constructor() {
    super('School onboarding cannot make this transition')
  }
}

export async function getSchoolOnboarding(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  return database.schoolOnboarding.findUnique({
    where: { schoolId: z.uuid().parse(schoolId) },
  })
}

export async function startSchoolOnboarding(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  now = new Date(),
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const current = await transaction.schoolOnboarding.findUnique({
      where: { schoolId },
    })
    if (
      current &&
      current.status !== 'notStarted' &&
      current.status !== 'paused'
    )
      throw new SchoolOnboardingStateError()
    const record = current
      ? await transaction.schoolOnboarding.update({
          where: { schoolId },
          data: { status: 'inProgress' },
        })
      : await transaction.schoolOnboarding.create({
          data: {
            schoolId,
            status: 'inProgress',
            startedAt: now,
            startedById: actorId,
          },
        })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolOnboarding.started',
      resourceType: 'school',
      resourceId: schoolId,
    })
    return record
  })
}

export async function pauseSchoolOnboarding(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const changed = await database.schoolOnboarding.updateMany({
    where: { schoolId, status: 'inProgress' },
    data: { status: 'paused' },
  })
  if (changed.count !== 1) throw new SchoolOnboardingStateError()
  return database.schoolOnboarding.findUniqueOrThrow({ where: { schoolId } })
}
