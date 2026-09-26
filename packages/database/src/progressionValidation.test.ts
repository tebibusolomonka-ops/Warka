import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  previewProgressionPlan,
  updateProgressionEntry,
  ProgressionValidationError,
} from './progressionValidation.js'

const actorId = randomUUID(),
  schoolId = randomUUID(),
  planId = randomUUID(),
  entryId = randomUUID(),
  studentId = randomUUID(),
  sourceYearId = randomUUID(),
  targetYearId = randomUUID(),
  gradeId = randomUUID(),
  classId = randomUUID()
const entry = {
  id: entryId,
  studentId,
  action: 'promote',
  targetGradeLevelId: gradeId,
  targetSchoolClassId: classId,
  sourceEnrollment: {
    id: randomUUID(),
    studentId,
    schoolId,
    academicYearId: sourceYearId,
    status: 'approved',
  },
}
function database(
  overrides: {
    targetSchoolId?: string
    targetEnrollment?: boolean
    action?: string
    sourceStatus?: string
    transfer?: boolean
    missingClass?: boolean
  } = {},
) {
  const selectedEntry = {
    ...entry,
    action: overrides.action ?? entry.action,
    targetSchoolClassId: overrides.missingClass
      ? null
      : entry.targetSchoolClassId,
    sourceEnrollment: {
      ...entry.sourceEnrollment,
      status: overrides.sourceStatus ?? 'approved',
    },
  }
  return {
    school: {
      findUnique: vi.fn(async () => ({ organizationId: randomUUID() })),
    },
    organizationMembership: { findUnique: vi.fn(async () => null) },
    schoolMembership: {
      findUnique: vi.fn(async () => ({ role: 'administrator' })),
    },
    progressionPlan: {
      findFirst: vi.fn(async () => ({
        id: planId,
        schoolId,
        status: 'draft',
        sourceAcademicYearId: sourceYearId,
        targetAcademicYearId: targetYearId,
        entries: [selectedEntry],
      })),
    },
    progressionEntry: {
      findFirst: vi.fn(async () => selectedEntry),
      update: vi.fn(async () => selectedEntry),
    },
    academicYear: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        schoolId,
      })),
    },
    gradeLevel: {
      findFirst: vi.fn(async () =>
        overrides.targetSchoolId && overrides.targetSchoolId !== schoolId
          ? null
          : { id: gradeId },
      ),
      findMany: vi.fn(async () =>
        overrides.targetSchoolId && overrides.targetSchoolId !== schoolId
          ? []
          : [{ id: gradeId }],
      ),
    },
    schoolClass: {
      findFirst: vi.fn(async () => ({ id: classId })),
      findMany: vi.fn(async () => [{ id: classId, gradeLevelId: gradeId }]),
    },
    transferRequest: {
      findMany: vi.fn(async () => (overrides.transfer ? [{ studentId }] : [])),
    },
    enrollment: {
      findMany: vi.fn(async () =>
        overrides.targetEnrollment ? [{ studentId }] : [],
      ),
    },
  } as unknown as PrismaClient
}

describe('progression validation', () => {
  it('previews counts without updating records', async () => {
    const db = database()
    const preview = await previewProgressionPlan(db, actorId, schoolId, planId)
    expect(preview.counts.promote).toBe(1)
    expect(preview.blockingErrors).toBe(0)
    expect(db.progressionEntry.update).not.toHaveBeenCalled()
  })
  it('identifies target conflicts and manual review', async () => {
    expect(
      (
        await previewProgressionPlan(
          database({ targetEnrollment: true }),
          actorId,
          schoolId,
          planId,
        )
      ).problems,
    ).toContainEqual({ code: 'targetEnrollment', entryId })
    expect(
      (
        await previewProgressionPlan(
          database({ action: 'manualReview' }),
          actorId,
          schoolId,
          planId,
        )
      ).problems,
    ).toContainEqual({ code: 'manualReview', entryId })
  })
  it('identifies withdrawn sources, transfers, and missing target classes', async () => {
    const preview = await previewProgressionPlan(
      database({
        sourceStatus: 'withdrawn',
        transfer: true,
        missingClass: true,
      }),
      actorId,
      schoolId,
      planId,
    )
    expect(preview.problems).toContainEqual({
      code: 'withdrawnSource',
      entryId,
    })
    expect(preview.problems).toContainEqual({
      code: 'unresolvedTransfer',
      entryId,
    })
    expect(preview.problems).toContainEqual({
      code: 'missingTargetClass',
      entryId,
    })
  })
  it('rejects cross-school target grades during an entry edit', async () => {
    await expect(
      updateProgressionEntry(
        database({ targetSchoolId: randomUUID() }),
        actorId,
        schoolId,
        planId,
        entryId,
        { action: 'promote', targetGradeLevelId: gradeId },
      ),
    ).rejects.toBeInstanceOf(ProgressionValidationError)
  })
})
