import type { PrismaClient, BackupFrequency } from '@prisma/client'

export type BackupPolicyInput = {
  enabled: boolean
  frequency: BackupFrequency
  retentionCount: number
  verificationRequired: boolean
}

export function backupDue(
  policy: BackupPolicyInput,
  lastCompletedAt: Date | null,
  now = new Date(),
) {
  if (!policy.enabled) return false
  const interval = policy.frequency === 'daily' ? 86_400_000 : 604_800_000
  return (
    !lastCompletedAt || now.getTime() - lastCompletedAt.getTime() >= interval
  )
}

export function cleanupEligible<
  T extends { id: string; status: string; createdAt: Date },
>(records: T[], policy: BackupPolicyInput) {
  return [...records]
    .filter(
      (record) =>
        record.status === 'verified' ||
        (!policy.verificationRequired && record.status === 'completed'),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(policy.retentionCount)
    .map((record) => record.id)
}

export async function updateBackupPolicy(
  database: PrismaClient,
  actorId: string,
  input: BackupPolicyInput,
) {
  if (
    !Number.isInteger(input.retentionCount) ||
    input.retentionCount < 1 ||
    input.retentionCount > 365
  )
    throw new Error('Invalid backup retention count')
  return database.$transaction(async (tx) => {
    const policy = await tx.backupPolicy.upsert({
      where: { id: 'database' },
      create: { id: 'database', ...input, updatedById: actorId },
      update: { ...input, updatedById: actorId },
    })
    await tx.auditEvent.create({
      data: {
        actorUserId: actorId,
        action: 'backupPolicy.updated',
        resourceType: 'backupPolicy',
        resourceId: policy.id,
        metadata: {
          enabled: input.enabled,
          frequency: input.frequency,
          retentionCount: input.retentionCount,
          verificationRequired: input.verificationRequired,
        },
      },
    })
    return policy
  })
}
