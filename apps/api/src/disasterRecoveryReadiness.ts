import type { PrismaClient } from '@warka/database'
import { checkReadiness } from './readiness.js'
import { schedulerHealth } from './schedulerHealth.js'

export type DisasterRecoveryReadiness = {
  status: 'ready' | 'warning' | 'blocked'
  lastSuccessfulBackup: Date | null
  lastVerification: Date | null
  lastRestoreRehearsal: Date | null
  blockers: string[]
  warnings: string[]
}

function positiveHours(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24 * 365)
    throw new Error('Invalid disaster recovery policy')
  return parsed
}

export async function evaluateDisasterRecoveryReadiness(input: {
  database: PrismaClient
  env?: NodeJS.ProcessEnv
  now?: Date
  dependencyState?: { backupStorage: string; scheduler: string }
}): Promise<DisasterRecoveryReadiness> {
  const env = input.env ?? process.env
  const now = input.now ?? new Date()
  const backupMaxAgeHours = positiveHours(env.WARKA_DR_BACKUP_MAX_AGE_HOURS, 48)
  const verificationMaxAgeHours = positiveHours(
    env.WARKA_DR_VERIFICATION_MAX_AGE_HOURS,
    72,
  )
  const rehearsalMaxAgeHours = positiveHours(
    env.WARKA_DR_REHEARSAL_MAX_AGE_HOURS,
    24 * 90,
  )
  const [backup, verification, rehearsal, dependencies] = await Promise.all([
    input.database.backupRecord.findFirst({
      where: { status: { in: ['completed', 'verified'] } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    input.database.backupRecord.findFirst({
      where: { verificationResult: 'passed', verifiedAt: { not: null } },
      orderBy: { verifiedAt: 'desc' },
      select: { verifiedAt: true },
    }),
    input.database.restoreRehearsal.findFirst({
      where: { status: 'succeeded' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    input.dependencyState
      ? input.dependencyState
      : Promise.all([
          checkReadiness({ database: input.database, env }),
          schedulerHealth.snapshot(input.database),
        ]).then(([health, scheduler]) => ({
          backupStorage: health.dependencies.backupStorage,
          scheduler: scheduler.status,
        })),
  ])
  const blockers: string[] = []
  const warnings: string[] = []
  const stale = (date: Date | null | undefined, maxHours: number) =>
    !date || now.getTime() - date.getTime() > maxHours * 3_600_000
  if (dependencies.backupStorage !== 'ready')
    blockers.push('backupStorageUnavailable')
  if (stale(backup?.completedAt, backupMaxAgeHours))
    blockers.push(backup ? 'backupStale' : 'backupMissing')
  if (dependencies.scheduler !== 'healthy')
    warnings.push('backupSchedulerNotHealthy')
  if (stale(verification?.verifiedAt, verificationMaxAgeHours))
    warnings.push(verification ? 'verificationStale' : 'verificationMissing')
  if (stale(rehearsal?.completedAt, rehearsalMaxAgeHours))
    warnings.push(
      rehearsal ? 'restoreRehearsalStale' : 'restoreRehearsalMissing',
    )
  return {
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready',
    lastSuccessfulBackup: backup?.completedAt ?? null,
    lastVerification: verification?.verifiedAt ?? null,
    lastRestoreRehearsal: rehearsal?.completedAt ?? null,
    blockers,
    warnings,
  }
}
