import {
  reconcileInterruptedScheduledTasks,
  type PrismaClient,
} from '@warka/database'

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
  const [backups, scans, deliveries, rehearsals, pendingVerifications] =
    await Promise.all([
      database.backupRecord.findMany({
        where: { status: 'running', startedAt: { lte: cutoff } },
        select: { id: true },
        take: 100,
      }),
      database.fileScan.findMany({
        where: { status: 'scanning', startedAt: { lte: cutoff } },
        select: { id: true },
        take: 100,
      }),
      database.emailDelivery.findMany({
        where: { status: 'sending', startedAt: { lte: cutoff } },
        select: { id: true },
        take: 100,
      }),
      database.restoreRehearsal.count({
        where: { status: 'running', startedAt: { lte: cutoff } },
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
    scans.length
      ? database.fileScan.updateMany({
          where: { id: { in: scans.map(({ id }) => id) }, status: 'scanning' },
          data: {
            status: 'unavailable',
            completedAt: now,
            failureCode: 'WORKER_INTERRUPTED',
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
            status: 'failed',
            failedAt: now,
            failureCode: 'AMBIGUOUS',
          },
        })
      : { count: 0 },
  ])
  return {
    status: 'completed' as const,
    completedAt: now,
    interruptedExecutions: interrupted.length,
    interruptedBackups: backups.length,
    pendingBackupVerifications: pendingVerifications,
    staleFileScans: scans.length,
    ambiguousEmailDeliveries: deliveries.length,
    restoreRehearsalsForReview: rehearsals,
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
