import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  bulkPreparePromotions,
  bulkSetProgressionDecision,
} from './progressionBulk.js'
import { ProgressionPlanStateError } from './progressionPlans.js'
import { ProgressionValidationError } from './progressionValidation.js'

const actorId = randomUUID(),
  schoolId = randomUUID(),
  planId = randomUUID(),
  sourceYearId = randomUUID(),
  targetYearId = randomUUID(),
  sourceGradeId = randomUUID(),
  targetGradeId = randomUUID(),
  sourceClassId = randomUUID(),
  targetClassId = randomUUID(),
  entryId = randomUUID()
function database(options: { applied?: boolean; crossSchool?: boolean } = {}) {
  const tx = {
    progressionPlan: {
      findFirst: vi.fn(async () =>
        options.applied
          ? null
          : {
              id: planId,
              schoolId,
              sourceAcademicYearId: sourceYearId,
              targetAcademicYearId: targetYearId,
              status: 'draft',
            },
      ),
    },
    gradeLevel: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        options.crossSchool && where.id === targetGradeId
          ? null
          : { id: where.id },
      ),
    },
    schoolClass: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
      })),
    },
    progressionEntry: {
      count: vi.fn(async () => 1),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  }
  const db = {
    school: {
      findUnique: vi.fn(async () => ({ organizationId: randomUUID() })),
    },
    organizationMembership: { findUnique: vi.fn(async () => null) },
    schoolMembership: {
      findUnique: vi.fn(async () => ({ role: 'administrator' })),
    },
    $transaction: vi.fn(async (run: (value: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  } as unknown as PrismaClient
  return { db, tx }
}

describe('bulk progression tools', () => {
  it('prepares promotions scoped to source grade and class', async () => {
    const { db, tx } = database()
    await bulkPreparePromotions(db, actorId, schoolId, planId, {
      sourceGradeLevelId: sourceGradeId,
      sourceSchoolClassId: sourceClassId,
      targetGradeLevelId: targetGradeId,
      targetSchoolClassId: targetClassId,
    })
    expect(tx.progressionEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceEnrollment: expect.objectContaining({
            gradeLevelId: sourceGradeId,
            schoolClassId: sourceClassId,
          }),
        }),
        data: expect.objectContaining({
          action: 'promote',
          targetGradeLevelId: targetGradeId,
        }),
      }),
    )
  })
  it.each(['repeat', 'withdraw', 'manualReview'] as const)(
    'sets %s on selected entries only',
    async (action) => {
      const { db, tx } = database()
      await bulkSetProgressionDecision(db, actorId, schoolId, planId, {
        entryIds: [entryId],
        action,
        ...(action === 'repeat' ? { targetGradeLevelId: targetGradeId } : {}),
      })
      expect(tx.progressionEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [entryId] } }),
          data: expect.objectContaining({ action }),
        }),
      )
    },
  )
  it('rejects cross-school targets and applied plans', async () => {
    await expect(
      bulkPreparePromotions(
        database({ crossSchool: true }).db,
        actorId,
        schoolId,
        planId,
        {
          sourceGradeLevelId: sourceGradeId,
          targetGradeLevelId: targetGradeId,
        },
      ),
    ).rejects.toBeInstanceOf(ProgressionValidationError)
    await expect(
      bulkPreparePromotions(
        database({ applied: true }).db,
        actorId,
        schoolId,
        planId,
        {
          sourceGradeLevelId: sourceGradeId,
          targetGradeLevelId: targetGradeId,
        },
      ),
    ).rejects.toBeInstanceOf(ProgressionPlanStateError)
  })
})
