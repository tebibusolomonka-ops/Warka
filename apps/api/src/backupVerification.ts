import { spawn } from 'node:child_process'
import type { PrismaClient } from '@warka/database'
import type { BackupStorage } from './backupService.js'

export interface ArchiveInspector {
  inspect(path: string): Promise<void>
}

export const nativeArchiveInspector: ArchiveInspector = {
  async inspect(path) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('pg_restore', ['--list', path], {
        shell: false,
        env: { PATH: process.env.PATH },
        stdio: 'ignore',
      })
      child.once('error', () => reject(new Error('Archive inspection failed')))
      child.once('close', (code) =>
        code === 0 ? resolve() : reject(new Error('Archive inspection failed')),
      )
    })
  },
}

export async function verifyBackup(input: {
  database: PrismaClient
  id: string
  storage: BackupStorage
  inspector?: ArchiveInspector
}) {
  const record = await input.database.backupRecord.findUnique({
    where: { id: input.id },
  })
  if (
    !record ||
    !['completed', 'verified'].includes(record.status) ||
    !record.storageReference ||
    !record.sizeBytes ||
    !record.checksum ||
    !record.completedAt ||
    !record.startedAt
  ) {
    throw new Error('Backup is not ready for verification')
  }
  let passed = false
  try {
    const artifact = await input.storage.inspect(
      `${record.storageReference}.dump`,
    )
    if (
      artifact.sizeBytes <= 0n ||
      artifact.sizeBytes !== record.sizeBytes ||
      artifact.checksum !== record.checksum ||
      record.startedAt > record.completedAt
    ) {
      throw new Error('Backup integrity check failed')
    }
    await (input.inspector ?? nativeArchiveInspector).inspect(artifact.path)
    passed = true
  } catch {
    passed = false
  }
  await input.database.backupRecord.update({
    where: { id: input.id },
    data: {
      status: passed ? 'verified' : 'completed',
      verifiedAt: new Date(),
      verificationResult: passed ? 'passed' : 'failed',
      verificationReason: passed
        ? null
        : 'Backup integrity verification failed',
    },
  })
  return passed
}
