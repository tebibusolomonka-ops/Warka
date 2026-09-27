import type { PrismaClient } from '@warka/database'
import { cleanupEligible, recordAuditEvent } from '@warka/database'
import type { BackupStorage } from './backupService.js'

export async function backupCleanupCandidates(database: PrismaClient) {
  const policy = await database.backupPolicy.findUnique({
    where: { id: 'database' },
  })
  if (!policy?.enabled) return []
  const records = await database.backupRecord.findMany({
    where: { status: { in: ['completed', 'verified'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      rehearsals: { where: { status: 'running' }, select: { id: true } },
    },
  })
  const verifying = await database.scheduledTaskExecution.findMany({
    where: { taskType: 'backupVerification', status: 'running' },
    select: { resourceId: true },
  })
  const protectedIds = new Set(verifying.map((task) => task.resourceId))
  const eligible = new Set(cleanupEligible(records, policy))
  const validVerified = records.filter((record) => record.status === 'verified')
  if (policy.verificationRequired && validVerified.length <= 1) return []
  return records.filter(
    (record) =>
      eligible.has(record.id) &&
      record.rehearsals.length === 0 &&
      !protectedIds.has(record.id) &&
      !!record.storageReference &&
      (!policy.verificationRequired || record.status === 'verified'),
  )
}

export async function cleanupBackupArtifacts(input: {
  database: PrismaClient
  storage: BackupStorage
  actorId: string
}) {
  const candidates = await backupCleanupCandidates(input.database)
  const deleted: string[] = []
  const failed: string[] = []
  for (const record of candidates) {
    const claimed = await input.database.backupRecord.updateMany({
      where: { id: record.id, status: record.status },
      data: { status: 'deleting' },
    })
    if (claimed.count !== 1) continue
    try {
      await input.storage.remove(`${record.storageReference}.dump`)
    } catch {
      await input.database.backupRecord.updateMany({
        where: { id: record.id, status: 'deleting' },
        data: { status: record.status },
      })
      failed.push(record.id)
      continue
    }
    await input.database.backupRecord.update({
      where: { id: record.id },
      data: { status: 'deleted', deletedAt: new Date() },
    })
    await recordAuditEvent(input.database, {
      actorUserId: input.actorId,
      action: 'backupArtifact.deleted',
      resourceType: 'backupRecord',
      resourceId: record.id,
    })
    deleted.push(record.id)
  }
  return { deleted, failed }
}
