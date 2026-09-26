import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { recordAuditEvent } from './auditEvents.js'
import { evaluateSchoolReadiness } from './onboardingReadiness.js'
import { listOnboardingChecklist } from './onboardingChecklist.js'

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
  return database.$transaction(async (transaction) => {
    const changed = await transaction.schoolOnboarding.updateMany({
      where: { schoolId, status: 'inProgress' },
      data: { status: 'paused' },
    })
    if (changed.count !== 1) throw new SchoolOnboardingStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolOnboarding.paused',
      resourceType: 'school',
      resourceId: schoolId,
    })
    return transaction.schoolOnboarding.findUniqueOrThrow({
      where: { schoolId },
    })
  })
}

export async function submitSchoolOnboarding(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const [readiness, checklist] = await Promise.all([
    evaluateSchoolReadiness(database, actorId, schoolId),
    listOnboardingChecklist(database, actorId, schoolId),
  ])
  if (
    readiness.status === 'blocked' ||
    checklist.some(
      (item) => item.source === 'manual' && item.status === 'pending',
    )
  )
    throw new SchoolOnboardingStateError()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.schoolOnboarding.updateMany({
      where: { schoolId, status: 'inProgress' },
      data: { status: 'readyForReview' },
    })
    if (changed.count !== 1) throw new SchoolOnboardingStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolOnboarding.submitted',
      resourceType: 'school',
      resourceId: schoolId,
    })
    return transaction.schoolOnboarding.findUniqueOrThrow({
      where: { schoolId },
    })
  })
}

export async function completeSchoolOnboarding(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  now = new Date(),
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const readiness = await evaluateSchoolReadiness(database, actorId, schoolId)
  if (readiness.status === 'blocked') throw new SchoolOnboardingStateError()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.schoolOnboarding.updateMany({
      where: { schoolId, status: 'readyForReview' },
      data: { status: 'completed', completedAt: now, completedById: actorId },
    })
    if (changed.count !== 1) throw new SchoolOnboardingStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolOnboarding.completed',
      resourceType: 'school',
      resourceId: schoolId,
    })
    return transaction.schoolOnboarding.findUniqueOrThrow({
      where: { schoolId },
    })
  })
}
