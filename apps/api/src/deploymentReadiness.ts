import type { PrismaClient } from '@warka/database'
import { checkReadiness } from './readiness.js'
import { checkCommunicationSchedulingReadiness } from './communicationSchedulingReadiness.js'
import { validateProductionConfiguration } from './productionConfiguration.js'
import { checkMigrationReadiness } from './migrationReadiness.js'

export type DeploymentReadiness = {
  status: 'ready' | 'degraded' | 'blocked'
  reasons: string[]
  dependencies: {
    database: string
    documentRenderer: string
    backupStorage: string
    scanner: string
    email: string
    communicationScheduler: string
  }
  migration: 'unknown' | 'ready' | 'pending' | 'failed' | 'unavailable'
}

export async function evaluateDeploymentReadiness(input: {
  database: PrismaClient
  env?: NodeJS.ProcessEnv
  readiness?: Awaited<ReturnType<typeof checkReadiness>>
  communication?: Awaited<
    ReturnType<typeof checkCommunicationSchedulingReadiness>
  >
  migration?: DeploymentReadiness['migration']
}): Promise<DeploymentReadiness> {
  const env = input.env ?? process.env
  const [health, communication] = await Promise.all([
    input.readiness ?? checkReadiness({ database: input.database, env }),
    input.communication ??
      checkCommunicationSchedulingReadiness({ database: input.database, env }),
  ])
  const reasons: string[] = []
  const config = validateProductionConfiguration(env)
  if (config.length) reasons.push('configurationInvalid')
  if (health.dependencies.database !== 'ready')
    reasons.push('databaseUnavailable')
  if (health.dependencies.documentRenderer !== 'ready')
    reasons.push('documentRendererUnavailable')
  const migration =
    input.migration ?? (await checkMigrationReadiness(input.database))
  if (migration === 'failed' || migration === 'pending')
    reasons.push('migrationNotReady')
  if (migration === 'unavailable' || migration === 'unknown')
    reasons.push('migrationUnverified')
  if (
    env.WARKA_BACKUP_SCHEDULER_ENABLED === 'true' &&
    health.dependencies.backupStorage !== 'ready'
  )
    reasons.push('backupStorageUnavailable')
  if (
    env.WARKA_FILE_SCAN_SCHEDULER_ENABLED === 'true' &&
    health.scanner !== 'available'
  )
    reasons.push('scannerUnavailable')
  if (
    env.WARKA_EMAIL_OUTBOX_ENABLED === 'true' &&
    communication.status !== 'ready'
  )
    reasons.push('communicationUnavailable')
  const blocked = reasons.some((reason) =>
    [
      'configurationInvalid',
      'databaseUnavailable',
      'documentRendererUnavailable',
      'migrationNotReady',
    ].includes(reason),
  )
  return {
    status: blocked ? 'blocked' : reasons.length ? 'degraded' : 'ready',
    reasons,
    dependencies: {
      database: health.dependencies.database,
      documentRenderer: health.dependencies.documentRenderer,
      backupStorage: health.dependencies.backupStorage,
      scanner: health.scanner ?? 'disabled',
      email: health.email,
      communicationScheduler: communication.status,
    },
    migration,
  }
}
