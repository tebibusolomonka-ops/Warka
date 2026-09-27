import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import type { BackupStorage } from './backupService.js'
import {
  backupCleanupCandidates,
  cleanupBackupArtifacts,
} from './backupRetention.js'

vi.mock('@warka/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@warka/database')>()
  return { ...original, recordAuditEvent: vi.fn() }
})

const date = (day: number) =>
  new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`)
const record = (
  id: string,
  day: number,
  status = 'verified',
  rehearsal = false,
) => ({
  id,
  status,
  createdAt: date(day),
  storageReference: `backup_${id}`,
  rehearsals: rehearsal ? [{ id: 'active-rehearsal' }] : [],
})

function fixture(
  records: ReturnType<typeof record>[],
  verifying: string[] = [],
) {
  const database = {
    backupPolicy: {
      findUnique: vi.fn().mockResolvedValue({
        enabled: true,
        frequency: 'daily',
        retentionCount: 1,
        verificationRequired: true,
      }),
    },
    backupRecord: {
      findMany: vi.fn().mockResolvedValue(records),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    scheduledTaskExecution: {
      findMany: vi
        .fn()
        .mockResolvedValue(verifying.map((resourceId) => ({ resourceId }))),
    },
  } as unknown as PrismaClient
  return database
}

describe('backup artifact retention', () => {
  it('keeps the newest required verified backup and protects active rehearsal and verification', async () => {
    const database = fixture(
      [
        record('new', 27),
        record('rehearsing', 26, 'verified', true),
        record('verifying', 25),
        record('old', 24),
      ],
      ['verifying'],
    )
    expect(
      (await backupCleanupCandidates(database)).map((item) => item.id),
    ).toEqual(['old'])
  })

  it('does not delete within retention count or the last verified copy', async () => {
    const database = fixture([record('only', 27)])
    expect(await backupCleanupCandidates(database)).toEqual([])
  })

  it('preserves record status when storage deletion fails', async () => {
    const database = fixture([record('new', 27), record('old', 24)])
    const storage = {
      remove: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    } as unknown as BackupStorage
    const result = await cleanupBackupArtifacts({
      database,
      storage,
      actorId: 'operator',
    })
    expect(result).toEqual({ deleted: [], failed: ['old'] })
    expect(database.backupRecord.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'verified' } }),
    )
    expect(database.backupRecord.update).not.toHaveBeenCalled()
  })

  it('deletes through storage and preserves history with audit', async () => {
    const database = fixture([record('new', 27), record('old', 24)])
    const storage = {
      remove: vi.fn().mockResolvedValue(undefined),
    } as unknown as BackupStorage
    const result = await cleanupBackupArtifacts({
      database,
      storage,
      actorId: 'operator',
    })
    expect(result).toEqual({ deleted: ['old'], failed: [] })
    expect(storage.remove).toHaveBeenCalledWith('backup_old.dump')
    expect(database.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'deleted' }),
      }),
    )
  })
})
