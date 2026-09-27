import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  backupDue,
  cleanupEligible,
  updateBackupPolicy,
} from './backupPolicy.js'

const policy = {
  enabled: true,
  frequency: 'daily' as const,
  retentionCount: 1,
  verificationRequired: true,
}

describe('backup policy', () => {
  it('evaluates due dates and marks only excess verified backups eligible', () => {
    expect(
      backupDue(policy, new Date('2026-01-01'), new Date('2026-01-02')),
    ).toBe(true)
    expect(
      backupDue(
        policy,
        new Date('2026-01-01T12:00:00Z'),
        new Date('2026-01-02'),
      ),
    ).toBe(false)
    expect(
      cleanupEligible(
        [
          { id: 'old', status: 'verified', createdAt: new Date('2026-01-01') },
          { id: 'new', status: 'verified', createdAt: new Date('2026-01-02') },
          {
            id: 'unverified',
            status: 'completed',
            createdAt: new Date('2025-12-30'),
          },
        ],
        policy,
      ),
    ).toEqual(['old'])
  })

  it('audits policy updates in one transaction', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'database' })
    const create = vi.fn()
    const tx = { backupPolicy: { upsert }, auditEvent: { create } }
    const database = {
      $transaction: async (work: (value: typeof tx) => Promise<unknown>) =>
        work(tx),
    } as unknown as PrismaClient
    await updateBackupPolicy(database, 'owner', policy)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'backupPolicy.updated' }),
      }),
    )
  })
})
