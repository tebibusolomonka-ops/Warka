import {
  Prisma,
  type PrismaClient,
  type ProgressionAction,
} from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { ProgressionPlanStateError } from './progressionPlans.js'
import { recordAuditEvent } from './auditEvents.js'

export const UpdateProgressionEntrySchema = z.strictObject({
  action: z.enum(['promote', 'repeat', 'withdraw', 'manualReview']),
  targetGradeLevelId: z.uuid().nullable().optional(),
  targetSchoolClassId: z.uuid().nullable().optional(),
})
export type UpdateProgressionEntry = z.input<
  typeof UpdateProgressionEntrySchema
>
export type ProgressionProblem = {
  code:
    | 'yearScope'
    | 'sameYear'
    | 'sourceEnrollment'
    | 'targetGrade'
    | 'targetClass'
    | 'duplicateStudent'
    | 'targetEnrollment'
    | 'manualReview'
    | 'missingTargetGrade'
  entryId?: string
}
export class ProgressionValidationError extends Error {
  constructor(readonly problems: ProgressionProblem[]) {
    super('Progression plan has blocking errors')
  }
}

export async function updateProgressionEntry(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
  entryId: string,
  input: UpdateProgressionEntry,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(planId)
  z.uuid().parse(entryId)
  const data = UpdateProgressionEntrySchema.parse(input)
  const plan = await database.progressionPlan.findFirst({
    where: { id: planId, schoolId, status: 'draft' },
  })
  if (!plan) throw new ProgressionPlanStateError()
  const entry = await database.progressionEntry.findFirst({
    where: { id: entryId, planId },
  })
  if (!entry) throw new ProgressionPlanStateError()
  if (data.action === 'promote' || data.action === 'repeat') {
    if (!data.targetGradeLevelId)
      throw new ProgressionValidationError([
        { code: 'missingTargetGrade', entryId },
      ])
    const grade = await database.gradeLevel.findFirst({
      where: { id: data.targetGradeLevelId, schoolId },
    })
    if (!grade)
      throw new ProgressionValidationError([{ code: 'targetGrade', entryId }])
    if (data.targetSchoolClassId) {
      const schoolClass = await database.schoolClass.findFirst({
        where: {
          id: data.targetSchoolClassId,
          schoolId,
          academicYearId: plan.targetAcademicYearId,
          gradeLevelId: data.targetGradeLevelId,
        },
      })
      if (!schoolClass)
        throw new ProgressionValidationError([{ code: 'targetClass', entryId }])
    }
  }
  return database.progressionEntry.update({
    where: { id: entryId },
    data: {
      action: data.action,
      targetGradeLevelId:
        data.action === 'promote' || data.action === 'repeat'
          ? (data.targetGradeLevelId ?? null)
          : null,
      targetSchoolClassId:
        data.action === 'promote' || data.action === 'repeat'
          ? (data.targetSchoolClassId ?? null)
          : null,
    },
  })
}

export async function previewProgressionPlanInTransaction(
  database: Prisma.TransactionClient,
  schoolId: string,
  planId: string,
) {
  const plan = await database.progressionPlan.findFirst({
    where: { id: planId, schoolId },
    include: {
      entries: { include: { sourceEnrollment: true }, orderBy: { id: 'asc' } },
    },
  })
  if (!plan) throw new ProgressionPlanStateError()
  const [source, target, grades, classes, targetEnrollments] =
    await Promise.all([
      database.academicYear.findFirst({
        where: { id: plan.sourceAcademicYearId, schoolId },
      }),
      database.academicYear.findFirst({
        where: { id: plan.targetAcademicYearId, schoolId },
      }),
      database.gradeLevel.findMany({
        where: { schoolId },
        select: { id: true },
      }),
      database.schoolClass.findMany({
        where: { schoolId, academicYearId: plan.targetAcademicYearId },
        select: { id: true, gradeLevelId: true },
      }),
      database.enrollment.findMany({
        where: { schoolId, academicYearId: plan.targetAcademicYearId },
        select: { studentId: true },
      }),
    ])
  const problems: ProgressionProblem[] = []
  if (!source || !target) problems.push({ code: 'yearScope' })
  if (source?.id === target?.id) problems.push({ code: 'sameYear' })
  const gradeIds = new Set(grades.map((item) => item.id))
  const classGrades = new Map(
    classes.map((item) => [item.id, item.gradeLevelId]),
  )
  const existing = new Set(targetEnrollments.map((item) => item.studentId))
  const students = new Set<string>()
  const counts: Record<ProgressionAction, number> = {
    promote: 0,
    repeat: 0,
    withdraw: 0,
    manualReview: 0,
  }
  for (const entry of plan.entries) {
    counts[entry.action] += 1
    if (students.has(entry.studentId))
      problems.push({ code: 'duplicateStudent', entryId: entry.id })
    students.add(entry.studentId)
    const enrollment = entry.sourceEnrollment
    if (
      enrollment.schoolId !== schoolId ||
      enrollment.academicYearId !== plan.sourceAcademicYearId ||
      enrollment.studentId !== entry.studentId ||
      enrollment.status !== 'approved'
    )
      problems.push({ code: 'sourceEnrollment', entryId: entry.id })
    if (entry.action === 'manualReview')
      problems.push({ code: 'manualReview', entryId: entry.id })
    if (entry.action === 'promote' || entry.action === 'repeat') {
      if (!entry.targetGradeLevelId)
        problems.push({ code: 'missingTargetGrade', entryId: entry.id })
      else if (!gradeIds.has(entry.targetGradeLevelId))
        problems.push({ code: 'targetGrade', entryId: entry.id })
      if (
        entry.targetSchoolClassId &&
        classGrades.get(entry.targetSchoolClassId) !== entry.targetGradeLevelId
      )
        problems.push({ code: 'targetClass', entryId: entry.id })
      if (existing.has(entry.studentId))
        problems.push({ code: 'targetEnrollment', entryId: entry.id })
    }
  }
  return { plan, counts, problems, blockingErrors: problems.length }
}
export async function previewProgressionPlan(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const preview = await previewProgressionPlanInTransaction(
    database,
    schoolId,
    z.uuid().parse(planId),
  )
  return {
    planId,
    status: preview.plan.status,
    counts: preview.counts,
    problems: preview.problems,
    blockingErrors: preview.blockingErrors,
  }
}
export async function markProgressionPlanReviewed(
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
      if (preview.plan.status !== 'draft') throw new ProgressionPlanStateError()
      if (preview.problems.length)
        throw new ProgressionValidationError(preview.problems)
      const changed = await transaction.progressionPlan.updateMany({
        where: { id: planId, schoolId, status: 'draft' },
        data: {
          status: 'reviewed',
          reviewedAt: new Date(),
          reviewedById: actorId,
        },
      })
      if (changed.count !== 1) throw new ProgressionPlanStateError()
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'progressionPlan.reviewed',
        resourceType: 'progressionPlan',
        resourceId: planId,
      })
      return transaction.progressionPlan.findUniqueOrThrow({
        where: { id: planId },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
