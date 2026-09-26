import type { PrismaClient } from '@warka/database'
import {
  getYearClosingReadiness,
  startAcademicYearClosing,
  completeAcademicYearClosing,
  createProgressionPlan,
  listProgressionPlans,
  getProgressionPlan,
  updateProgressionEntry,
  bulkPreparePromotions,
  bulkSetProgressionDecision,
  previewProgressionPlan,
  markProgressionPlanReviewed,
  applyProgressionPlan,
  refreshProgressionExceptions,
  listProgressionExceptions,
  resolveProgressionException,
  type CreateProgressionPlan,
  type UpdateProgressionEntry,
  type BulkPromotion,
  type BulkDecision,
} from '@warka/database'

export type AcademicRolloverService = {
  readiness(
    actorId: string,
    schoolId: string,
    yearId: string,
  ): ReturnType<typeof getYearClosingReadiness>
  startClosing(
    actorId: string,
    schoolId: string,
    yearId: string,
  ): ReturnType<typeof startAcademicYearClosing>
  completeClosing(
    actorId: string,
    schoolId: string,
    yearId: string,
  ): ReturnType<typeof completeAcademicYearClosing>
  createPlan(
    actorId: string,
    input: CreateProgressionPlan,
  ): ReturnType<typeof createProgressionPlan>
  listPlans(
    actorId: string,
    schoolId: string,
  ): ReturnType<typeof listProgressionPlans>
  getPlan(
    actorId: string,
    schoolId: string,
    planId: string,
  ): ReturnType<typeof getProgressionPlan>
  updateEntry(
    actorId: string,
    schoolId: string,
    planId: string,
    entryId: string,
    input: UpdateProgressionEntry,
  ): ReturnType<typeof updateProgressionEntry>
  bulkPromote(
    actorId: string,
    schoolId: string,
    planId: string,
    input: BulkPromotion,
  ): ReturnType<typeof bulkPreparePromotions>
  bulkDecide(
    actorId: string,
    schoolId: string,
    planId: string,
    input: BulkDecision,
  ): ReturnType<typeof bulkSetProgressionDecision>
  preview(
    actorId: string,
    schoolId: string,
    planId: string,
  ): ReturnType<typeof previewProgressionPlan>
  review(
    actorId: string,
    schoolId: string,
    planId: string,
  ): ReturnType<typeof markProgressionPlanReviewed>
  apply(
    actorId: string,
    schoolId: string,
    planId: string,
  ): ReturnType<typeof applyProgressionPlan>
  refreshExceptions(
    actorId: string,
    schoolId: string,
    planId: string,
  ): ReturnType<typeof refreshProgressionExceptions>
  listExceptions(
    actorId: string,
    schoolId: string,
    planId: string,
  ): ReturnType<typeof listProgressionExceptions>
  resolveException(
    actorId: string,
    schoolId: string,
    planId: string,
    exceptionId: string,
    note: string,
  ): ReturnType<typeof resolveProgressionException>
}

export function prismaAcademicRolloverService(
  database: PrismaClient,
): AcademicRolloverService {
  return {
    readiness: (actorId, schoolId, yearId) =>
      getYearClosingReadiness(database, actorId, schoolId, yearId),
    startClosing: (actorId, schoolId, yearId) =>
      startAcademicYearClosing(database, actorId, schoolId, yearId),
    completeClosing: (actorId, schoolId, yearId) =>
      completeAcademicYearClosing(database, actorId, schoolId, yearId),
    createPlan: (actorId, input) =>
      createProgressionPlan(database, actorId, input),
    listPlans: (actorId, schoolId) =>
      listProgressionPlans(database, actorId, schoolId),
    getPlan: (actorId, schoolId, planId) =>
      getProgressionPlan(database, actorId, schoolId, planId),
    updateEntry: (actorId, schoolId, planId, entryId, input) =>
      updateProgressionEntry(
        database,
        actorId,
        schoolId,
        planId,
        entryId,
        input,
      ),
    bulkPromote: (actorId, schoolId, planId, input) =>
      bulkPreparePromotions(database, actorId, schoolId, planId, input),
    bulkDecide: (actorId, schoolId, planId, input) =>
      bulkSetProgressionDecision(database, actorId, schoolId, planId, input),
    preview: (actorId, schoolId, planId) =>
      previewProgressionPlan(database, actorId, schoolId, planId),
    review: (actorId, schoolId, planId) =>
      markProgressionPlanReviewed(database, actorId, schoolId, planId),
    apply: (actorId, schoolId, planId) =>
      applyProgressionPlan(database, actorId, schoolId, planId),
    refreshExceptions: (actorId, schoolId, planId) =>
      refreshProgressionExceptions(database, actorId, schoolId, planId),
    listExceptions: (actorId, schoolId, planId) =>
      listProgressionExceptions(database, actorId, schoolId, planId),
    resolveException: (actorId, schoolId, planId, exceptionId, note) =>
      resolveProgressionException(
        database,
        actorId,
        schoolId,
        planId,
        exceptionId,
        note,
      ),
  }
}
