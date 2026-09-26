import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { ProgressionPlanStateError } from './progressionPlans.js'
import {
  previewProgressionPlanInTransaction,
  ProgressionValidationError,
} from './progressionValidation.js'
import { createEnrollment, withdrawEnrollment } from './enrollments.js'
import { recordEnrollmentHistory } from './enrollmentHistory.js'
import { recordAuditEvent } from './auditEvents.js'

export type ProgressionApplyResult = {
  planId: string
  newEnrollments: number
  promotions: number
  repeats: number
  withdrawalDecisions: number
  sourceEnrollmentsPreserved: number
}

export async function applyProgressionPlan(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
): Promise<ProgressionApplyResult> {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  return database.$transaction(
    async (transaction) => {
      const preview = await previewProgressionPlanInTransaction(
        transaction,
        schoolId,
        planId,
      )
      if (preview.plan.status !== 'reviewed')
        throw new ProgressionPlanStateError()
      if (preview.problems.length)
        throw new ProgressionValidationError(preview.problems)
      let newEnrollments = 0
      for (const entry of preview.plan.entries) {
        const source = entry.sourceEnrollment
        const previous = {
          academicYearId: source.academicYearId,
          gradeLevelId: source.gradeLevelId,
          schoolClassId: source.schoolClassId,
        }
        if (entry.action === 'withdraw') {
          await withdrawEnrollment(transaction, schoolId, source.id, actorId)
          continue
        }
        if (entry.action === 'manualReview')
          throw new ProgressionValidationError([
            { code: 'manualReview', entryId: entry.id },
          ])
        if (!entry.targetGradeLevelId)
          throw new ProgressionValidationError([
            { code: 'missingTargetGrade', entryId: entry.id },
          ])
        const target = await createEnrollment(transaction, {
          studentId: entry.studentId,
          schoolId,
          academicYearId: preview.plan.targetAcademicYearId,
          gradeLevelId: entry.targetGradeLevelId,
          ...(entry.targetSchoolClassId
            ? { schoolClassId: entry.targetSchoolClassId }
            : {}),
        })
        const next = {
          academicYearId: target.academicYearId,
          gradeLevelId: target.gradeLevelId,
          schoolClassId: target.schoolClassId,
        }
        const eventType = entry.action === 'promote' ? 'promoted' : 'reEnrolled'
        await recordEnrollmentHistory(transaction, {
          enrollmentId: source.id,
          eventType,
          effectiveAt: target.createdAt,
          performedById: actorId,
          previous,
          next,
        })
        await recordEnrollmentHistory(transaction, {
          enrollmentId: target.id,
          eventType,
          effectiveAt: target.createdAt,
          performedById: actorId,
          previous,
          next,
        })
        newEnrollments += 1
      }
      const changed = await transaction.progressionPlan.updateMany({
        where: { id: planId, schoolId, status: 'reviewed' },
        data: {
          status: 'applied',
          appliedAt: new Date(),
          appliedById: actorId,
        },
      })
      if (changed.count !== 1) throw new ProgressionPlanStateError()
      const result = {
        planId,
        newEnrollments,
        promotions: preview.counts.promote,
        repeats: preview.counts.repeat,
        withdrawalDecisions: preview.counts.withdraw,
        sourceEnrollmentsPreserved: preview.plan.entries.length,
      }
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'progressionPlan.applied',
        resourceType: 'progressionPlan',
        resourceId: planId,
        metadata: {
          newEnrollments,
          promotions: result.promotions,
          repeats: result.repeats,
          withdrawalDecisions: result.withdrawalDecisions,
        },
      })
      return result
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
