import type { PrismaClient } from '@prisma/client'

export async function createPendingBackup(
  database: PrismaClient,
  createdById: string,
) {
  return database.backupRecord.create({ data: { createdById } })
}

export async function startBackup(database: PrismaClient, id: string) {
  const result = await database.backupRecord.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'running', startedAt: new Date() },
  })
  if (result.count !== 1) throw new Error('Backup is not pending')
}

export async function completeBackup(
  database: PrismaClient,
  id: string,
  artifact: { sizeBytes: bigint; checksum: string; storageReference: string },
) {
  if (
    artifact.sizeBytes <= 0n ||
    !/^[a-f0-9]{64}$/.test(artifact.checksum) ||
    !/^[a-zA-Z0-9_-]+$/.test(artifact.storageReference)
  ) {
    throw new Error('A complete backup requires a valid artifact')
  }
  const result = await database.backupRecord.updateMany({
    where: { id, status: 'running' },
    data: { ...artifact, status: 'completed', completedAt: new Date() },
  })
  if (result.count !== 1) throw new Error('Backup is not running')
}

export async function failBackup(
  database: PrismaClient,
  id: string,
  reason: string,
) {
  await database.backupRecord.updateMany({
    where: { id, status: { in: ['pending', 'running'] } },
    data: {
      status: 'failed',
      failureReason: reason.slice(0, 200),
      completedAt: new Date(),
    },
  })
}
