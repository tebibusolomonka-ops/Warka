import {
  reconcileInterruptedScheduledTasks,
  type PrismaClient,
} from '@warka/database'
import { reconcileStaleFileScans } from './fileScanReconciliation.js'

export type StartupReconciliationResult = {
  status: 'notRun' | 'completed' | 'timedOut' | 'failed'
  completedAt: Date | null
  interruptedExecutions: number
  interruptedBackups: number
  pendingBackupVerifications: number
  staleFileScans: number
  ambiguousEmailDeliveries: number
  restoreRehearsalsForReview: number
}

const emptyResult = (): StartupReconciliationResult => ({
  status: 'notRun',
  completedAt: null,
  interruptedExecutions: 0,
  interruptedBackups: 0,
  pendingBackupVerifications: 0,
  staleFileScans: 0,
  ambiguousEmailDeliveries: 0,
  restoreRehearsalsForReview: 0,
})

class StartupReconciliationStatus {
  private result = emptyResult()
  record(result: StartupReconciliationResult) {
    this.result = result
  }
  snapshot() {
    return this.result
  }
}

export const startupReconciliationStatus = new StartupReconciliationStatus()

async function reconcileDomains(database: PrismaClient, now: Date) {
  const cutoff = new Date(now.getTime() - 300_000)
  const interrupted = await reconcileInterruptedScheduledTasks(database, {
    now,
    staleAfterMs: 300_000,
  })
  const [backups, scanResult, deliveries, rehearsals, pendingVerifications] =
    await Promise.all([
      database.backupRecord.findMany({
        where: { status: 'running', startedAt: { lte: cutoff } },
        select: { id: true },
        take: 100,
      }),
      reconcileStaleFileScans(database, { now, staleAfterMs: 300_000 }),
      database.emailDelivery.findMany({
        where: { status: 'sending', startedAt: { lte: cutoff } },
        select: { id: true },
        take: 100,
      }),
      database.restoreRehearsal.findMany({
        where: { status: 'running', startedAt: { lte: cutoff } },
        select: { id: true },
        take: 100,
      }),
      database.backupRecord.count({
        where: { status: 'completed', verificationResult: null },
      }),
    ])
  await Promise.all([
    backups.length
      ? database.backupRecord.updateMany({
          where: { id: { in: backups.map(({ id }) => id) }, status: 'running' },
          data: {
            status: 'failed',
            completedAt: now,
            failureReason: 'Interrupted; operator reconciliation required',
          },
        })
      : { count: 0 },
    deliveries.length
      ? database.emailDelivery.updateMany({
          where: {
            id: { in: deliveries.map(({ id }) => id) },
            status: 'sending',
          },
          data: {
            status: 'deliveryUnknown',
            failedAt: now,
            failureCode: 'AMBIGUOUS',
          },
        })
      : { count: 0 },
  ])
  const reviews = [
    ...backups.map(({ id }) => ({
      domain: 'backup' as const,
      resourceType: 'backupRecord',
      resourceReference: id,
      reasonCode: 'INTERRUPTED_BACKUP',
    })),
    ...deliveries.map(({ id }) => ({
      domain: 'emailDelivery' as const,
      resourceType: 'emailDelivery',
      resourceReference: id,
      reasonCode: 'PROVIDER_OUTCOME_UNKNOWN',
    })),
    ...rehearsals.map(({ id }) => ({
      domain: 'restoreRehearsal' as const,
      resourceType: 'restoreRehearsal',
      resourceReference: id,
      reasonCode: 'INTERRUPTED_REHEARSAL',
    })),
  ]
  for (const review of reviews) {
    const existing = await database.recoveryReview.findFirst({
      where: {
        domain: review.domain,
        resourceReference: review.resourceReference,
        status: 'open',
      },
      select: { id: true },
    })
    if (!existing) await database.recoveryReview.create({ data: review })
  }
  return {
    status: 'completed' as const,
    completedAt: now,
    interruptedExecutions: interrupted.length,
    interruptedBackups: backups.length,
    pendingBackupVerifications: pendingVerifications,
    staleFileScans: scanResult.detected,
    ambiguousEmailDeliveries: deliveries.length,
    restoreRehearsalsForReview: rehearsals.length,
  }
}

export async function runStartupReconciliation(
  database: PrismaClient,
  input: { now?: Date; timeoutMs?: number } = {},
) {
  const now = input.now ?? new Date()
  const timeoutMs = input.timeoutMs ?? 10_000
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      reconcileDomains(database, now),
      new Promise<StartupReconciliationResult>((resolve) => {
        timer = setTimeout(
          () => resolve({ ...emptyResult(), status: 'timedOut' }),
          timeoutMs,
        )
        timer.unref()
      }),
    ])
    startupReconciliationStatus.record(result)
    return result
  } catch {
    const result = { ...emptyResult(), status: 'failed' as const }
    startupReconciliationStatus.record(result)
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}
