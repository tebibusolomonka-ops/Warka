import {
  Prisma,
  type PrismaClient,
  type ProgressionExceptionKind,
} from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import {
  previewProgressionPlanInTransaction,
  type ProgressionProblem,
} from './progressionValidation.js'
import { recordAuditEvent } from './auditEvents.js'
import { ProgressionPlanStateError } from './progressionPlans.js'

export class ProgressionExceptionStateError extends Error {
  constructor() {
    super('Progression exception still requires an explicit resolution')
  }
}
const resolutionSchema = z.string().trim().min(3).max(500)
const problemKinds: Partial<
  Record<ProgressionProblem['code'], ProgressionExceptionKind>
> = {
  missingTargetClass: 'missingTargetClass',
  targetEnrollment: 'existingTargetEnrollment',
  withdrawnSource: 'withdrawnSource',
  unresolvedTransfer: 'unresolvedTransfer',
  incompleteSource: 'incompleteSource',
  manualReview: 'manualReview',
}
export function exceptionKind(problem: ProgressionProblem) {
  return problemKinds[problem.code] ?? null
}
export async function refreshProgressionExceptions(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  return database.$transaction(
    async (transaction) => {
      const preview = await previewProgressionPlanInTransaction(
        transaction,
        schoolId,
        planId,
      )
      if (
        preview.plan.status === 'applied' ||
        preview.plan.status === 'cancelled'
      )
        throw new ProgressionPlanStateError()
      const open = await transaction.progressionException.findMany({
        where: { planId, status: 'open' },
        select: { entryId: true, kind: true },
      })
      const existing = new Set(
        open.map((item) => `${item.entryId}:${item.kind}`),
      )
      for (const problem of preview.problems) {
        const kind = exceptionKind(problem)
        if (
          !kind ||
          !problem.entryId ||
          existing.has(`${problem.entryId}:${kind}`)
        )
          continue
        await transaction.progressionException.create({
          data: { planId, entryId: problem.entryId, kind },
        })
        existing.add(`${problem.entryId}:${kind}`)
      }
      return transaction.progressionException.findMany({
        where: { planId },
        orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
export async function listProgressionExceptions(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  const plan = await database.progressionPlan.findFirst({
    where: { id: planId, schoolId },
    select: { id: true },
  })
  if (!plan) throw new ProgressionPlanStateError()
  return database.progressionException.findMany({
    where: { planId },
    orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
  })
}
export async function resolveProgressionException(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
  exceptionId: string,
  note: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  z.uuid().parse(exceptionId)
  const resolutionNote = resolutionSchema.parse(note)
  return database.$transaction(
    async (transaction) => {
      const exception = await transaction.progressionException.findFirst({
        where: { id: exceptionId, planId, status: 'open', plan: { schoolId } },
      })
      if (!exception) throw new ProgressionExceptionStateError()
      const preview = await previewProgressionPlanInTransaction(
        transaction,
        schoolId,
        planId,
      )
      if (
        preview.plan.status === 'applied' ||
        preview.plan.status === 'cancelled'
      )
        throw new ProgressionPlanStateError()
      if (
        preview.problems.some(
          (problem) =>
            problem.entryId === exception.entryId &&
            exceptionKind(problem) === exception.kind,
        )
      )
        throw new ProgressionExceptionStateError()
      const changed = await transaction.progressionException.updateMany({
        where: { id: exceptionId, status: 'open' },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedById: actorId,
          resolutionNote,
        },
      })
      if (changed.count !== 1) throw new ProgressionExceptionStateError()
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'progressionException.resolved',
        resourceType: 'progressionException',
        resourceId: exceptionId,
        metadata: { kind: exception.kind },
      })
      return transaction.progressionException.findUniqueOrThrow({
        where: { id: exceptionId },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
