import { Prisma, type PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  evaluateDataQuality,
  DataQualityRunConflictError,
} from './dataQualityRuns.js'
import { checkStudentDataQuality } from './studentDataQuality.js'
import { requireDataQualityAdministrator } from './dataQualityIssues.js'

vi.mock('./studentDataQuality.js', () => ({ checkStudentDataQuality: vi.fn() }))
vi.mock('./enrollmentDataQuality.js', () => ({
  checkEnrollmentDataQuality: vi.fn(),
}))
vi.mock('./academicDataQuality.js', () => ({
  checkAcademicDataQuality: vi.fn(),
}))
vi.mock('./documentDataQuality.js', () => ({
  checkDocumentDataQuality: vi.fn(),
}))
vi.mock('./dataQualityIssues.js', () => ({
  requireDataQualityAdministrator: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const finding = {
  category: 'student' as const,
  severity: 'warning' as const,
  code: 'STUDENT_REFERENCE_MISSING',
  summary: 'Reference missing',
  entityType: 'student',
  entityId: 'student',
}

function fixture(
  open: {
    id: string
    code: string
    entityType: string | null
    entityId: string | null
  }[] = [],
) {
  const transaction = {
    dataQualityIssue: {
      findMany: vi.fn().mockResolvedValueOnce(open).mockResolvedValueOnce(open),
      update: vi.fn().mockResolvedValue({}),
      create: vi
        .fn()
        .mockResolvedValue({ id: 'new', ...finding, status: 'open' }),
    },
    dataQualityRun: {
      update: vi.fn().mockResolvedValue({ status: 'completed' }),
    },
  }
  const database = {
    dataQualityRun: {
      create: vi.fn().mockResolvedValue({ id: 'run' }),
      update: vi.fn().mockResolvedValue({ status: 'failed' }),
    },
    $transaction: vi.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}
beforeEach(() => {
  vi.mocked(checkStudentDataQuality).mockReset().mockResolvedValue([finding])
  vi.mocked(requireDataQualityAdministrator)
    .mockReset()
    .mockResolvedValue(undefined)
})

describe('data quality runs', () => {
  it('creates and completes manual and scheduled runs with issue counts', async () => {
    const { database, transaction } = fixture()
    await evaluateDataQuality(
      database,
      { schoolId, trigger: 'manual', checks: ['student'] },
      actorId,
    )
    expect(requireDataQualityAdministrator).toHaveBeenCalledWith(
      database,
      actorId,
      schoolId,
    )
    expect(transaction.dataQualityIssue.create).toHaveBeenCalledWith({
      data: { schoolId, ...finding },
    })
    expect(transaction.dataQualityRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ warningCount: 1, status: 'completed' }),
      }),
    )
    const scheduled = fixture()
    await evaluateDataQuality(scheduled.database, {
      schoolId,
      trigger: 'scheduled',
      checks: ['student'],
    })
    expect(scheduled.database.dataQualityRun.create).toHaveBeenCalledWith({
      data: { schoolId, trigger: 'scheduled', checksExecuted: ['student'] },
    })
  })
  it('resolves disappeared open issues without changing source records', async () => {
    vi.mocked(checkStudentDataQuality).mockResolvedValue([])
    const { database, transaction } = fixture([
      {
        id: 'old',
        code: 'STUDENT_REFERENCE_MISSING',
        entityType: 'student',
        entityId: 'student',
      },
    ])
    await evaluateDataQuality(database, {
      schoolId,
      trigger: 'scheduled',
      checks: ['student'],
    })
    expect(transaction.dataQualityIssue.update).toHaveBeenCalledWith({
      where: { id: 'old' },
      data: expect.objectContaining({ status: 'resolved' }),
    })
    expect(transaction.dataQualityIssue.create).not.toHaveBeenCalled()
  })
  it('rejects concurrent runs and records failures', async () => {
    const { database } = fixture()
    vi.mocked(database.dataQualityRun.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.2',
      }),
    )
    await expect(
      evaluateDataQuality(database, {
        schoolId,
        trigger: 'scheduled',
        checks: ['student'],
      }),
    ).rejects.toBeInstanceOf(DataQualityRunConflictError)
    vi.mocked(checkStudentDataQuality).mockRejectedValueOnce(
      new Error('query failed'),
    )
    await expect(
      evaluateDataQuality(database, {
        schoolId,
        trigger: 'scheduled',
        checks: ['student'],
      }),
    ).rejects.toThrow('query failed')
    expect(database.dataQualityRun.update).toHaveBeenCalledWith({
      where: { id: 'run' },
      data: expect.objectContaining({
        status: 'failed',
        failureCode: 'QUALITY_CHECK_FAILED',
      }),
    })
  })
})
