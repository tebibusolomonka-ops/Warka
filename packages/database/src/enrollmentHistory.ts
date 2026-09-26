import { z } from 'zod'
import type { EnrollmentHistoryType, Prisma } from '@prisma/client'

const contextSchema = z.strictObject({
  academicYearId: z.uuid().optional(),
  gradeLevelId: z.uuid().optional(),
  schoolClassId: z.uuid().nullable().optional(),
})
export const RecordEnrollmentHistorySchema = z.strictObject({
  enrollmentId: z.uuid(),
  eventType: z.enum([
    'enrolled',
    'submitted',
    'approved',
    'classChanged',
    'gradeChanged',
    'promoted',
    'withdrawn',
    'reEnrolled',
  ]),
  effectiveAt: z.date(),
  performedById: z.uuid().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
  previous: contextSchema.optional(),
  next: contextSchema.optional(),
})
export type RecordEnrollmentHistory = z.input<
  typeof RecordEnrollmentHistorySchema
>
export async function recordEnrollmentHistory(
  database: Pick<Prisma.TransactionClient, 'enrollmentHistoryEvent'>,
  input: RecordEnrollmentHistory,
) {
  const data = RecordEnrollmentHistorySchema.parse(input)
  return database.enrollmentHistoryEvent.create({
    data: {
      enrollmentId: data.enrollmentId,
      eventType: data.eventType as EnrollmentHistoryType,
      effectiveAt: data.effectiveAt,
      performedById: data.performedById ?? null,
      reason: data.reason ?? null,
      previousAcademicYearId: data.previous?.academicYearId ?? null,
      previousGradeLevelId: data.previous?.gradeLevelId ?? null,
      previousSchoolClassId: data.previous?.schoolClassId ?? null,
      newAcademicYearId: data.next?.academicYearId ?? null,
      newGradeLevelId: data.next?.gradeLevelId ?? null,
      newSchoolClassId: data.next?.schoolClassId ?? null,
    },
  })
}
export function listEnrollmentHistory(
  database: Pick<Prisma.TransactionClient, 'enrollmentHistoryEvent'>,
  enrollmentId: string,
) {
  return database.enrollmentHistoryEvent.findMany({
    where: { enrollmentId: z.uuid().parse(enrollmentId) },
    orderBy: [{ effectiveAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })
}
