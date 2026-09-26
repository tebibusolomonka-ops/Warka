import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  exceptionKind,
  resolveProgressionException,
  ProgressionExceptionStateError,
} from './progressionExceptions.js'

const actorId = randomUUID(),
  schoolId = randomUUID(),
  planId = randomUUID(),
  entryId = randomUUID(),
  exceptionId = randomUUID(),
  yearId = randomUUID(),
  studentId = randomUUID(),
  gradeId = randomUUID()
function database(action: 'manualReview' | 'withdraw') {
  const tx = {
    progressionException: {
      findFirst: vi.fn(async () => ({
        id: exceptionId,
        planId,
        entryId,
        kind: 'manualReview',
        status: 'open',
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: exceptionId,
        status: 'resolved',
        resolutionNote: 'Decision recorded',
      })),
    },
    progressionPlan: {
      findFirst: vi.fn(async () => ({
        id: planId,
        schoolId,
        status: 'draft',
        sourceAcademicYearId: yearId,
        targetAcademicYearId: randomUUID(),
        entries: [
          {
            id: entryId,
            studentId,
            action,
            targetGradeLevelId: null,
            targetSchoolClassId: null,
            sourceEnrollment: {
              id: randomUUID(),
              studentId,
              schoolId,
              academicYearId: yearId,
              gradeLevelId: gradeId,
              schoolClassId: null,
              status: 'approved',
            },
          },
        ],
      })),
    },
    academicYear: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        schoolId,
      })),
    },
    gradeLevel: { findMany: vi.fn(async () => [{ id: gradeId }]) },
    schoolClass: { findMany: vi.fn(async () => []) },
    enrollment: { findMany: vi.fn(async () => []) },
    transferRequest: { findMany: vi.fn(async () => []) },
    auditEvent: { create: vi.fn(async () => ({})) },
  }
  return {
    ...tx,
    school: {
      findUnique: vi.fn(async () => ({ organizationId: randomUUID() })),
    },
    organizationMembership: { findUnique: vi.fn(async () => null) },
    schoolMembership: {
      findUnique: vi.fn(async () => ({ role: 'administrator' })),
    },
    $transaction: vi.fn(async (run: (tx: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  } as unknown as PrismaClient
}

describe('progression exceptions', () => {
  it('maps operational problems without assigning a dropout label', () => {
    expect(exceptionKind({ code: 'manualReview', entryId })).toBe(
      'manualReview',
    )
    expect(exceptionKind({ code: 'withdrawnSource', entryId })).toBe(
      'withdrawnSource',
    )
    expect(exceptionKind({ code: 'targetEnrollment', entryId })).toBe(
      'existingTargetEnrollment',
    )
    expect(exceptionKind({ code: 'unresolvedTransfer', entryId })).toBe(
      'unresolvedTransfer',
    )
  })
  it('refuses to resolve a still-open manual review', async () => {
    await expect(
      resolveProgressionException(
        database('manualReview'),
        actorId,
        schoolId,
        planId,
        exceptionId,
        'Decision recorded',
      ),
    ).rejects.toBeInstanceOf(ProgressionExceptionStateError)
  })
  it('records resolution after the underlying decision changes', async () => {
    const db = database('withdraw')
    expect(
      (
        await resolveProgressionException(
          db,
          actorId,
          schoolId,
          planId,
          exceptionId,
          'Decision recorded',
        )
      ).status,
    ).toBe('resolved')
    expect(db.progressionException.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolutionNote: 'Decision recorded',
          status: 'resolved',
        }),
      }),
    )
  })
})
