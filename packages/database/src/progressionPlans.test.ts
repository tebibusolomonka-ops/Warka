import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  CreateProgressionPlanSchema,
  createProgressionPlan,
  ProgressionPlanSourceError,
} from './progressionPlans.js'

const actorId = randomUUID(),
  schoolId = randomUUID(),
  sourceAcademicYearId = randomUUID(),
  targetAcademicYearId = randomUUID(),
  studentId = randomUUID(),
  enrollmentId = randomUUID(),
  planId = randomUUID()
const input = { schoolId, sourceAcademicYearId, targetAcademicYearId }
function database(targetSchoolId = schoolId) {
  const transaction = {
    academicYear: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === sourceAcademicYearId
          ? { id: sourceAcademicYearId, schoolId, status: 'closed' }
          : {
              id: targetAcademicYearId,
              schoolId: targetSchoolId,
              status: 'active',
            },
      ),
    },
    enrollment: {
      findMany: vi.fn(async () => [{ id: enrollmentId, studentId }]),
    },
    progressionPlan: {
      create: vi.fn(async () => ({ id: planId, ...input, status: 'draft' })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: planId,
        ...input,
        status: 'draft',
        entries: [
          {
            studentId,
            sourceEnrollmentId: enrollmentId,
            action: 'manualReview',
          },
        ],
      })),
    },
    progressionEntry: { createMany: vi.fn(async () => ({ count: 1 })) },
    auditEvent: { create: vi.fn(async () => ({})) },
  }
  const db = {
    school: {
      findUnique: vi.fn(async () => ({ organizationId: randomUUID() })),
    },
    organizationMembership: { findUnique: vi.fn(async () => null) },
    schoolMembership: {
      findUnique: vi.fn(async () => ({ role: 'administrator' })),
    },
    $transaction: vi.fn(
      async (run: (tx: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    ),
  } as unknown as PrismaClient
  return { db, transaction }
}

describe('progression plans', () => {
  it('requires different years', () => {
    expect(() =>
      CreateProgressionPlanSchema.parse({
        ...input,
        targetAcademicYearId: sourceAcademicYearId,
      }),
    ).toThrow()
  })
  it('creates manual-review candidates without changing enrollments', async () => {
    const { db, transaction } = database()
    const plan = await createProgressionPlan(db, actorId, input)
    expect(plan.entries).toMatchObject([{ action: 'manualReview', studentId }])
    expect(transaction.progressionEntry.createMany).toHaveBeenCalledWith({
      data: [{ planId, studentId, sourceEnrollmentId: enrollmentId }],
    })
    expect(transaction.enrollment.findMany).toHaveBeenCalled()
  })
  it('rejects years from another school', async () => {
    const { db, transaction } = database(randomUUID())
    transaction.academicYear.findFirst.mockImplementation(async ({ where }) =>
      where.id === sourceAcademicYearId
        ? { id: sourceAcademicYearId, schoolId, status: 'closed' }
        : (null as never),
    )
    await expect(
      createProgressionPlan(db, actorId, input),
    ).rejects.toBeInstanceOf(ProgressionPlanSourceError)
    expect(transaction.progressionPlan.create).not.toHaveBeenCalled()
  })
})
