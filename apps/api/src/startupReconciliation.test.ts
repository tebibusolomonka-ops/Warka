import { describe, expect, it, vi } from 'vitest'
import { runStartupReconciliation } from './startupReconciliation.js'
import { reconcileStaleFileScans } from './fileScanReconciliation.js'

vi.mock('./fileScanReconciliation.js', () => ({
  reconcileStaleFileScans: vi.fn(),
}))

function databaseFixture() {
  return {
    scheduledTaskExecution: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'execution', taskType: 'retentionEvaluation' },
        ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    backupRecord: {
      findMany: vi.fn().mockResolvedValue([{ id: 'backup' }]),
      count: vi.fn().mockResolvedValue(2),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    fileScan: {
      findMany: vi.fn().mockResolvedValue([{ id: 'scan' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    emailDelivery: {
      findMany: vi.fn().mockResolvedValue([{ id: 'delivery' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    restoreRehearsal: {
      findMany: vi.fn().mockResolvedValue([{ id: 'rehearsal' }]),
    },
    recoveryReview: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('startup task reconciliation', () => {
  it('uses domain-specific safe transitions', async () => {
    vi.mocked(reconcileStaleFileScans).mockResolvedValue({
      detected: 1,
      rescheduled: ['replacement'],
    })
    const database = databaseFixture()
    const now = new Date('2026-09-30T10:00:00.000Z')
    const result = await runStartupReconciliation(database as never, { now })
    expect(result).toEqual({
      status: 'completed',
      completedAt: now,
      interruptedExecutions: 1,
      interruptedBackups: 1,
      pendingBackupVerifications: 2,
      staleFileScans: 1,
      ambiguousEmailDeliveries: 1,
      restoreRehearsalsForReview: 1,
    })
    expect(reconcileStaleFileScans).toHaveBeenCalledWith(database, {
      now,
      staleAfterMs: 300_000,
    })
    expect(database.emailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'deliveryUnknown',
          failureCode: 'AMBIGUOUS',
        }),
      }),
    )
    expect(database.restoreRehearsal.findMany).toHaveBeenCalled()
    expect(database.recoveryReview.create).toHaveBeenCalledTimes(3)
  })
})
