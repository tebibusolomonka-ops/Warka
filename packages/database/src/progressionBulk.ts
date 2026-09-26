import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { ProgressionPlanStateError } from './progressionPlans.js'
import { ProgressionValidationError } from './progressionValidation.js'

export const BulkPromotionSchema = z.strictObject({
  sourceGradeLevelId: z.uuid(),
  sourceSchoolClassId: z.uuid().nullable().optional(),
  targetGradeLevelId: z.uuid(),
  targetSchoolClassId: z.uuid().nullable().optional(),
})
export const BulkDecisionSchema = z.strictObject({
  entryIds: z.array(z.uuid()).min(1).max(500),
  action: z.enum(['repeat', 'withdraw', 'manualReview']),
  targetGradeLevelId: z.uuid().nullable().optional(),
  targetSchoolClassId: z.uuid().nullable().optional(),
})
export type BulkPromotion = z.input<typeof BulkPromotionSchema>
export type BulkDecision = z.input<typeof BulkDecisionSchema>

async function draftPlan(
  database: Prisma.TransactionClient,
  schoolId: string,
  planId: string,
) {
  const plan = await database.progressionPlan.findFirst({
    where: { id: planId, schoolId, status: 'draft' },
  })
  if (!plan) throw new ProgressionPlanStateError()
  return plan
}
async function targetContext(
  database: Prisma.TransactionClient,
  schoolId: string,
  targetYearId: string,
  gradeId: string,
  classId?: string | null,
) {
  const grade = await database.gradeLevel.findFirst({
    where: { id: gradeId, schoolId },
  })
  if (!grade) throw new ProgressionValidationError([{ code: 'targetGrade' }])
  if (classId) {
    const schoolClass = await database.schoolClass.findFirst({
      where: {
        id: classId,
        schoolId,
        academicYearId: targetYearId,
        gradeLevelId: gradeId,
      },
    })
    if (!schoolClass)
      throw new ProgressionValidationError([{ code: 'targetClass' }])
  }
}
export async function bulkPreparePromotions(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
  input: BulkPromotion,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  const data = BulkPromotionSchema.parse(input)
  return database.$transaction(
    async (transaction) => {
      const plan = await draftPlan(transaction, schoolId, planId)
      const sourceGrade = await transaction.gradeLevel.findFirst({
        where: { id: data.sourceGradeLevelId, schoolId },
      })
      if (!sourceGrade)
        throw new ProgressionValidationError([{ code: 'sourceEnrollment' }])
      if (data.sourceSchoolClassId) {
        const schoolClass = await transaction.schoolClass.findFirst({
          where: {
            id: data.sourceSchoolClassId,
            schoolId,
            academicYearId: plan.sourceAcademicYearId,
            gradeLevelId: data.sourceGradeLevelId,
          },
        })
        if (!schoolClass)
          throw new ProgressionValidationError([{ code: 'sourceEnrollment' }])
      }
      await targetContext(
        transaction,
        schoolId,
        plan.targetAcademicYearId,
        data.targetGradeLevelId,
        data.targetSchoolClassId,
      )
      return transaction.progressionEntry.updateMany({
        where: {
          planId,
          plan: { status: 'draft', schoolId },
          sourceEnrollment: {
            schoolId,
            academicYearId: plan.sourceAcademicYearId,
            gradeLevelId: data.sourceGradeLevelId,
            ...(data.sourceSchoolClassId
              ? { schoolClassId: data.sourceSchoolClassId }
              : {}),
            status: 'approved',
          },
        },
        data: {
          action: 'promote',
          targetGradeLevelId: data.targetGradeLevelId,
          targetSchoolClassId: data.targetSchoolClassId ?? null,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
export async function bulkSetProgressionDecision(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
  input: BulkDecision,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  const data = BulkDecisionSchema.parse(input)
  if (new Set(data.entryIds).size !== data.entryIds.length)
    throw new ProgressionPlanStateError()
  return database.$transaction(
    async (transaction) => {
      const plan = await draftPlan(transaction, schoolId, planId)
      if (data.action === 'repeat') {
        if (!data.targetGradeLevelId)
          throw new ProgressionValidationError([{ code: 'missingTargetGrade' }])
        await targetContext(
          transaction,
          schoolId,
          plan.targetAcademicYearId,
          data.targetGradeLevelId,
          data.targetSchoolClassId,
        )
      }
      const count = await transaction.progressionEntry.count({
        where: {
          planId,
          id: { in: data.entryIds },
          sourceEnrollment: {
            schoolId,
            academicYearId: plan.sourceAcademicYearId,
            status: 'approved',
          },
        },
      })
      if (count !== data.entryIds.length) throw new ProgressionPlanStateError()
      const changed = await transaction.progressionEntry.updateMany({
        where: {
          planId,
          id: { in: data.entryIds },
          plan: { status: 'draft', schoolId },
        },
        data: {
          action: data.action,
          targetGradeLevelId:
            data.action === 'repeat' ? (data.targetGradeLevelId ?? null) : null,
          targetSchoolClassId:
            data.action === 'repeat'
              ? (data.targetSchoolClassId ?? null)
              : null,
        },
      })
      if (changed.count !== data.entryIds.length)
        throw new ProgressionPlanStateError()
      return changed
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
