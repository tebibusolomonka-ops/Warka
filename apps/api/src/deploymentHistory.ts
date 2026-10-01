import type { PrismaClient } from '@warka/database'

export const deploymentStatuses = [
  'planned',
  'deploying',
  'healthy',
  'failed',
  'rolledBack',
] as const

export async function recordDeployment(
  database: PrismaClient,
  input: {
    releaseVersion: string
    revision: string
    environmentLabel: string
    manifestChecksum: string
    initiatedBy?: string
  },
) {
  return database.deploymentRecord.create({ data: input })
}

export async function completeDeployment(
  database: PrismaClient,
  id: string,
  status: 'healthy' | 'failed' | 'rolledBack',
  failureSummary?: string,
) {
  return database.deploymentRecord.update({
    where: { id },
    data: {
      status,
      completedAt: new Date(),
      ...(failureSummary
        ? { failureSummary: failureSummary.slice(0, 500) }
        : {}),
    },
  })
}
