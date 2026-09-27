import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  backupConnection,
  executeBackup,
  LocalBackupStorage,
  type BackupProcess,
} from './backupService.js'

describe('PostgreSQL backup boundary', () => {
  it('parses validated connection details without adding passwords to arguments', () => {
    expect(
      backupConnection('postgresql://owner:s%40cret@localhost:5433/warka'),
    ).toEqual({
      host: 'localhost',
      port: '5433',
      database: 'warka',
      username: 'owner',
      password: 's@cret',
    })
    expect(() => backupConnection('https://example.test/db')).toThrow(
      'Invalid PostgreSQL',
    )
  })

  it('prevents reference traversal and computes artifact checksum', async () => {
    const root = await mkdtemp(join(tmpdir(), 'warka-backup-'))
    const storage = new LocalBackupStorage(root)
    await expect(storage.inspect('../secrets')).rejects.toThrow(
      'Invalid backup reference',
    )
    const artifact = await storage.allocate()
    await writeFile(artifact.path, 'backup bytes')
    const inspected = await storage.inspect(artifact.reference)
    expect(inspected.sizeBytes).toBe(12n)
    expect(inspected.checksum).toMatch(/^[a-f0-9]{64}$/)
    await storage.remove(artifact.reference)
  })

  it('records a completed artifact only after a successful dump and sanitizes failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'warka-backup-'))
    const storage = new LocalBackupStorage(root)
    const create = vi.fn().mockResolvedValue({ id: 'record' })
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = {
      backupRecord: { create, updateMany },
    } as unknown as PrismaClient
    const process: BackupProcess = {
      dump: async (_connection, destination) => {
        await writeFile(destination, 'archive')
      },
    }
    await executeBackup({
      database,
      actorId: 'owner',
      databaseUrl: 'postgresql://owner:secret@localhost/warka',
      storage,
      process,
    })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', sizeBytes: 7n }),
      }),
    )
    const failedProcess: BackupProcess = {
      dump: async () => {
        throw new Error('secret connection failed')
      },
    }
    await expect(
      executeBackup({
        database,
        actorId: 'owner',
        databaseUrl: 'postgresql://owner:secret@localhost/warka',
        storage,
        process: failedProcess,
      }),
    ).rejects.toThrow('Backup execution failed')
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          failureReason: 'Backup execution failed',
        }),
      }),
    )
    expect(
      JSON.stringify(updateMany.mock.calls, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ).not.toContain('secret')
  })
})
