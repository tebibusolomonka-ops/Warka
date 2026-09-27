import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { runRestoreRehearsal, type RestoreProcess } from './restoreRehearsal.js'
import type { BackupStorage } from './backupService.js'

const backup = {
  status: 'verified',
  storageReference: 'backup_123',
  sizeBytes: 10n,
  checksum: 'a'.repeat(64),
}

describe('restore rehearsal', () => {
  it('uses an isolated generated target, checks it, cleans it, and records success', async () => {
    const update = vi.fn()
    const database = {
      backupRecord: { findUnique: vi.fn().mockResolvedValue(backup) },
      restoreRehearsal: {
        create: vi.fn().mockResolvedValue({ id: 'rehearsal' }),
        update,
      },
    } as unknown as PrismaClient
    const storage = {
      inspect: vi
        .fn()
        .mockResolvedValue({
          path: 'archive',
          sizeBytes: 10n,
          checksum: backup.checksum,
        }),
    } as unknown as BackupStorage
    const process: RestoreProcess = {
      create: vi.fn(),
      restore: vi.fn(),
      check: vi.fn(),
      drop: vi.fn(),
    }
    const result = await runRestoreRehearsal({
      database,
      backupId: 'backup',
      actorId: 'owner',
      databaseUrl: 'postgresql://owner:secret@localhost/warka',
      storage,
      process,
    })
    expect(result.passed).toBe(true)
    const target = vi.mocked(process.create).mock.calls[0][1]
    expect(target).toMatch(/^warka_rehearsal_[a-f0-9]{32}$/)
    expect(target).not.toBe('warka')
    expect(process.restore).toHaveBeenCalledWith(
      expect.anything(),
      target,
      'archive',
    )
    expect(process.check).toHaveBeenCalledWith(expect.anything(), target)
    expect(process.drop).toHaveBeenCalledWith(expect.anything(), target)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded' }),
      }),
    )
  })

  it('records failure and attempts cleanup without exposing process errors', async () => {
    const update = vi.fn()
    const database = {
      backupRecord: { findUnique: vi.fn().mockResolvedValue(backup) },
      restoreRehearsal: {
        create: vi.fn().mockResolvedValue({ id: 'rehearsal' }),
        update,
      },
    } as unknown as PrismaClient
    const storage = {
      inspect: vi
        .fn()
        .mockResolvedValue({
          path: 'archive',
          sizeBytes: 10n,
          checksum: backup.checksum,
        }),
    } as unknown as BackupStorage
    const process: RestoreProcess = {
      create: vi.fn(),
      restore: vi.fn().mockRejectedValue(new Error('secret')),
      check: vi.fn(),
      drop: vi.fn(),
    }
    expect(
      (
        await runRestoreRehearsal({
          database,
          backupId: 'backup',
          actorId: 'owner',
          databaseUrl: 'postgresql://owner:secret@localhost/warka',
          storage,
          process,
        })
      ).passed,
    ).toBe(false)
    expect(process.drop).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          failureReason: 'Restore rehearsal failed',
        }),
      }),
    )
  })
})
