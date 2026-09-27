import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { completeBackup, startBackup } from './backupRecords.js'

describe('backup records', () => {
  it('starts only a pending record', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const database = { backupRecord: { updateMany } } as unknown as PrismaClient
    await expect(startBackup(database, 'backup')).rejects.toThrow('not pending')
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'backup', status: 'pending' } }),
    )
  })

  it('requires real artifact metadata before completion', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = { backupRecord: { updateMany } } as unknown as PrismaClient
    await expect(
      completeBackup(database, 'backup', {
        sizeBytes: 0n,
        checksum: 'bad',
        storageReference: 'x',
      }),
    ).rejects.toThrow('valid artifact')
    expect(updateMany).not.toHaveBeenCalled()
    await completeBackup(database, 'backup', {
      sizeBytes: 12n,
      checksum: 'a'.repeat(64),
      storageReference: 'backup_1',
    })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'backup', status: 'running' } }),
    )
  })
})
