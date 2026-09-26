import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  closingBlockers,
  getYearClosingReadiness,
  startAcademicYearClosing,
  completeAcademicYearClosing,
  AcademicYearClosingBlockedError,
  AcademicYearClosingPermissionError,
} from './academicYearClosing.js'

const actorId = randomUUID(),
  schoolId = randomUUID(),
  yearId = randomUUID(),
  organizationId = randomUUID()
const database = (
  role: string | null,
  counts = {
    pendingEnrollments: 0,
    unfinishedResults: 0,
    openDocumentRequests: 0,
  },
) => {
  let status = 'active'
  const transaction = {
    academicYear: {
      findFirst: vi.fn(async ({ where }: { where: { schoolId: string } }) =>
        where.schoolId === schoolId ? { id: yearId, schoolId, status } : null,
      ),
      findUniqueOrThrow: vi.fn(async () => ({ id: yearId, schoolId, status })),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { status: string }
          data: { status: string }
        }) => {
          if (where.status !== status) return { count: 0 }
          status = data.status
          return { count: 1 }
        },
      ),
    },
    enrollment: { count: vi.fn(async () => counts.pendingEnrollments) },
    resultSet: { count: vi.fn(async () => counts.unfinishedResults) },
    documentRequest: { count: vi.fn(async () => counts.openDocumentRequests) },
    auditEvent: { create: vi.fn(async () => ({})) },
  }
  return {
    ...transaction,
    school: { findUnique: vi.fn(async () => ({ organizationId })) },
    organizationMembership: { findUnique: vi.fn(async () => null) },
    schoolMembership: {
      findUnique: vi.fn(async () => (role ? { role } : null)),
    },
    $transaction: vi.fn(
      async (run: (tx: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    ),
  } as unknown as PrismaClient
}

describe('academic year closing', () => {
  it('reports blockers without changing records', () => {
    expect(
      closingBlockers({
        pendingEnrollments: 2,
        unfinishedResults: 1,
        openDocumentRequests: 0,
      }),
    ).toEqual([
      { kind: 'pendingEnrollments', count: 2 },
      { kind: 'unfinishedResults', count: 1 },
    ])
  })
  it('requires an administrator and explicit start before completion', async () => {
    await expect(
      getYearClosingReadiness(database('teacher'), actorId, schoolId, yearId),
    ).rejects.toBeInstanceOf(AcademicYearClosingPermissionError)
    const db = database('administrator')
    expect(
      (await getYearClosingReadiness(db, actorId, schoolId, yearId)).canClose,
    ).toBe(false)
    expect(
      (await startAcademicYearClosing(db, actorId, schoolId, yearId)).status,
    ).toBe('closing')
    expect(
      (await completeAcademicYearClosing(db, actorId, schoolId, yearId)).status,
    ).toBe('closed')
  })
  it('keeps closing blocked while year-bound work is incomplete', async () => {
    const db = database('administrator', {
      pendingEnrollments: 1,
      unfinishedResults: 0,
      openDocumentRequests: 0,
    })
    await startAcademicYearClosing(db, actorId, schoolId, yearId)
    await expect(
      completeAcademicYearClosing(db, actorId, schoolId, yearId),
    ).rejects.toBeInstanceOf(AcademicYearClosingBlockedError)
  })
})
