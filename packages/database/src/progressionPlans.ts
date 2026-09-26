import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { recordAuditEvent } from './auditEvents.js'

export const CreateProgressionPlanSchema = z
  .strictObject({
    schoolId: z.uuid(),
    sourceAcademicYearId: z.uuid(),
    targetAcademicYearId: z.uuid(),
  })
  .refine(
    (input) => input.sourceAcademicYearId !== input.targetAcademicYearId,
    {
      path: ['targetAcademicYearId'],
      message: 'Target year must differ from source',
    },
  )
export type CreateProgressionPlan = z.input<typeof CreateProgressionPlanSchema>
export class ProgressionPlanSourceError extends Error {
  constructor() {
    super(
      'Progression years must belong to the same school and target must be active',
    )
  }
}
export class DuplicateActiveProgressionPlanError extends Error {
  constructor() {
    super('An active progression plan already exists for these years')
  }
}
export class ProgressionPlanStateError extends Error {
  constructor() {
    super('Progression plan cannot change in its current state')
  }
}

export async function createProgressionPlan(
  database: PrismaClient,
  actorId: string,
  input: CreateProgressionPlan,
) {
  const data = CreateProgressionPlanSchema.parse(input)
  await requireAcademicYearAdmin(database, actorId, data.schoolId)
  try {
    return await database.$transaction(
      async (transaction) => {
        const [source, target] = await Promise.all([
          transaction.academicYear.findFirst({
            where: { id: data.sourceAcademicYearId, schoolId: data.schoolId },
          }),
          transaction.academicYear.findFirst({
            where: { id: data.targetAcademicYearId, schoolId: data.schoolId },
          }),
        ])
        if (!source || !target || target.status !== 'active')
          throw new ProgressionPlanSourceError()
        const candidates = await transaction.enrollment.findMany({
          where: {
            schoolId: data.schoolId,
            academicYearId: source.id,
            status: 'approved',
          },
          select: { id: true, studentId: true },
          orderBy: { id: 'asc' },
        })
        const plan = await transaction.progressionPlan.create({
          data: { ...data, createdById: actorId },
        })
        if (candidates.length)
          await transaction.progressionEntry.createMany({
            data: candidates.map((item) => ({
              planId: plan.id,
              studentId: item.studentId,
              sourceEnrollmentId: item.id,
            })),
          })
        await recordAuditEvent(transaction, {
          schoolId: data.schoolId,
          actorUserId: actorId,
          action: 'progressionPlan.created',
          resourceType: 'progressionPlan',
          resourceId: plan.id,
          metadata: { candidateCount: candidates.length },
        })
        return transaction.progressionPlan.findUniqueOrThrow({
          where: { id: plan.id },
          include: { entries: true },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new DuplicateActiveProgressionPlanError()
    throw error
  }
}
export async function getProgressionPlan(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  return database.progressionPlan.findFirst({
    where: { id: z.uuid().parse(planId), schoolId },
    include: {
      entries: {
        include: {
          student: {
            select: {
              studentReference: true,
              givenName: true,
              familyName: true,
            },
          },
          sourceEnrollment: {
            select: { gradeLevelId: true, schoolClassId: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })
}
export async function cancelProgressionPlan(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  planId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const changed = await database.progressionPlan.updateMany({
    where: {
      id: z.uuid().parse(planId),
      schoolId,
      status: { in: ['draft', 'reviewed'] },
    },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })
  if (changed.count !== 1) throw new ProgressionPlanStateError()
  return database.progressionPlan.findUniqueOrThrow({ where: { id: planId } })
}
