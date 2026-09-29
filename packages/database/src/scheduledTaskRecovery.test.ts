import { describe, expect, it, vi } from 'vitest'
import {
  interruptedTaskDisposition,
  reconcileInterruptedScheduledTasks,
} from './scheduledTaskExecutions.js'

describe('interrupted scheduled task recovery', () => {
  it('classifies task types according to replay safety', () => {
    expect(interruptedTaskDisposition('retentionEvaluation')).toBe(
      'safeToRetry',
    )
    expect(interruptedTaskDisposition('backupVerification')).toBe('safeToRetry')
    expect(interruptedTaskDisposition('fileScan')).toBe('safeToRetry')
    expect(interruptedTaskDisposition('emailDelivery')).toBe(
      'needsReconciliation',
    )
    expect(interruptedTaskDisposition('backup')).toBe('manualReview')
  })

  it('preserves stale executions and records interruption state', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'retention', taskType: 'retentionEvaluation' },
      { id: 'email', taskType: 'emailDelivery' },
    ])
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const now = new Date('2026-09-30T10:00:00.000Z')
    const result = await reconcileInterruptedScheduledTasks(
      { scheduledTaskExecution: { findMany, updateMany } } as never,
      { now, staleAfterMs: 60_000 },
    )

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'running',
          OR: [
            { leaseExpiresAt: { lte: now } },
            {
              leaseExpiresAt: null,
              startedAt: { lte: new Date('2026-09-30T09:59:00.000Z') },
            },
          ],
        },
      }),
    )
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'retention', status: 'running' },
      data: {
        status: 'interrupted',
        interruptedAt: now,
        recoveryDisposition: 'safeToRetry',
        recoveryReason: 'EXECUTION_OWNERSHIP_LOST',
      },
    })
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'email', status: 'running' },
      data: {
        status: 'interrupted',
        interruptedAt: now,
        recoveryDisposition: 'needsReconciliation',
        recoveryReason: 'EXECUTION_OWNERSHIP_LOST',
      },
    })
    expect(result).toEqual([
      { id: 'retention', disposition: 'safeToRetry' },
      { id: 'email', disposition: 'needsReconciliation' },
    ])
  })

  it('does not overwrite an execution changed concurrently', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const result = await reconcileInterruptedScheduledTasks(
      {
        scheduledTaskExecution: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: 'finished', taskType: 'backupVerification' },
            ]),
          updateMany,
        },
      } as never,
      { now: new Date('2026-09-30T10:00:00.000Z') },
    )
    expect(result).toEqual([])
  })
})
