import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { verifyBackup } from './backupVerification.js'
import type { BackupStorage } from './backupService.js'

const record = {
  id: 'one',
  status: 'completed',
  storageReference: 'backup_123',
  sizeBytes: 10n,
  checksum: 'a'.repeat(64),
  startedAt: new Date('2026-01-01'),
  completedAt: new Date('2026-01-02'),
}

describe('backup verification', () => {
  it('requires size, checksum, metadata, and archive inspection', async () => {
    const update = vi.fn()
    const database = {
      backupRecord: { findUnique: vi.fn().mockResolvedValue(record), update },
    } as unknown as PrismaClient
    const storage = {
      inspect: vi
        .fn()
        .mockResolvedValue({
          path: 'artifact',
          sizeBytes: 10n,
          checksum: record.checksum,
        }),
    } as unknown as BackupStorage
    const inspect = vi.fn()
    expect(
      await verifyBackup({
        database,
        id: 'one',
        storage,
        inspector: { inspect },
      }),
    ).toBe(true)
    expect(inspect).toHaveBeenCalledWith('artifact')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'verified',
          verificationResult: 'passed',
        }),
      }),
    )
  })

  it('records a failed checksum without deleting the artifact', async () => {
    const update = vi.fn()
    const database = {
      backupRecord: { findUnique: vi.fn().mockResolvedValue(record), update },
    } as unknown as PrismaClient
    const storage = {
      inspect: vi
        .fn()
        .mockResolvedValue({
          path: 'artifact',
          sizeBytes: 10n,
          checksum: 'b'.repeat(64),
        }),
      remove: vi.fn(),
    } as unknown as BackupStorage
    expect(
      await verifyBackup({
        database,
        id: 'one',
        storage,
        inspector: { inspect: vi.fn() },
      }),
    ).toBe(false)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          verificationResult: 'failed',
        }),
      }),
    )
    expect(storage.remove).not.toHaveBeenCalled()
  })
})
