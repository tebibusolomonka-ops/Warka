import { describe, expect, it, vi } from 'vitest'
import { reconcileStaleFileScans } from './fileScanReconciliation.js'

describe('file scan reconciliation', () => {
  it('preserves the interrupted scan and schedules one safe replacement', async () => {
    const createScan = vi.fn().mockResolvedValue({ id: 'replacement' })
    const createTask = vi.fn().mockResolvedValue({})
    const transaction = {
      fileScan: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'stale' }]),
        create: createScan,
      },
      scheduledTaskExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: createTask,
      },
    }
    const database = {
      fileScan: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'stale', fileAssetId: 'asset', scanner: 'clamav' },
          ]),
      },
      $transaction: (work: (value: unknown) => Promise<unknown>) =>
        work(transaction),
    }
    const result = await reconcileStaleFileScans(database as never, {
      now: new Date('2026-09-30T10:00:00.000Z'),
    })
    expect(result).toEqual({ detected: 1, rescheduled: ['replacement'] })
    expect(transaction.fileScan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'unavailable' }),
      }),
    )
    expect(createTask).toHaveBeenCalledOnce()
  })

  it('does not rescan quarantined or already reconciled assets', async () => {
    const database = {
      fileScan: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(),
    }
    await expect(reconcileStaleFileScans(database as never)).resolves.toEqual({
      detected: 0,
      rescheduled: [],
    })
    expect(database.fileScan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fileAsset: { status: 'pending', scanRequired: true },
        }),
      }),
    )
    expect(database.$transaction).not.toHaveBeenCalled()
  })
})
