import type {
  PrismaClient,
  ScheduledTaskType,
  TaskRecoveryDisposition,
} from '@prisma/client'
import { randomUUID } from 'node:crypto'

export async function enqueueFileScanTask(
  database: Pick<PrismaClient, 'scheduledTaskExecution'>,
  scanId: string,
) {
  return database.scheduledTaskExecution.create({
    data: {
      taskType: 'fileScan',
      scope: 'file_scan',
      resourceId: scanId,
      scheduledFor: new Date(),
      status: 'pending',
      attempt: 1,
    },
  })
}

export async function startScheduledTask(
  database: PrismaClient,
  taskType: ScheduledTaskType,
  scope: string,
  scheduledFor: Date,
  resourceId?: string,
  attempt = 1,
  seriesId: string = randomUUID(),
) {
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(scope) ||
    !Number.isInteger(attempt) ||
    attempt < 1
  )
    throw new Error('Invalid scheduled task metadata')
  return database.scheduledTaskExecution.create({
    data: {
      taskType,
      seriesId,
      scope,
      resourceId: resourceId ?? null,
      scheduledFor,
      startedAt: new Date(),
      status: 'running',
      attempt,
    },
  })
}

export async function completeScheduledTask(
  database: PrismaClient,
  id: string,
  resourceId?: string,
  summary?: { eligibleCount: number; oldestEligibleAt: Date | null },
) {
  if (
    summary &&
    (!Number.isInteger(summary.eligibleCount) || summary.eligibleCount < 0)
  )
    throw new Error('Invalid scheduled task summary')
  const result = await database.scheduledTaskExecution.updateMany({
    where: { id, status: 'running' },
    data: {
      status: 'completed',
      completedAt: new Date(),
      resourceId: resourceId ?? null,
      ...(summary ? summary : {}),
    },
  })
  if (result.count !== 1) throw new Error('Scheduled task is not running')
}

export async function failScheduledTask(
  database: PrismaClient,
  id: string,
  failureCode: string,
) {
  if (!/^[A-Z_]{1,60}$/.test(failureCode))
    throw new Error('Invalid scheduled task failure code')
  const result = await database.scheduledTaskExecution.updateMany({
    where: { id, status: 'running' },
    data: { status: 'failed', completedAt: new Date(), failureCode },
  })
  if (result.count !== 1) throw new Error('Scheduled task is not running')
}

export function interruptedTaskDisposition(
  taskType: ScheduledTaskType,
): TaskRecoveryDisposition {
  if (
    taskType === 'retentionEvaluation' ||
    taskType === 'backupVerification' ||
    taskType === 'fileScan'
  )
    return 'safeToRetry'
  if (taskType === 'emailDelivery') return 'needsReconciliation'
  return 'manualReview'
}

export async function reconcileInterruptedScheduledTasks(
  database: Pick<PrismaClient, 'scheduledTaskExecution'>,
  input: { now?: Date; staleAfterMs?: number } = {},
) {
  const now = input.now ?? new Date()
  const staleAfterMs = input.staleAfterMs ?? 300_000
  if (!Number.isInteger(staleAfterMs) || staleAfterMs < 1_000)
    throw new Error('Invalid interrupted task threshold')
  const cutoff = new Date(now.getTime() - staleAfterMs)
  const stale = await database.scheduledTaskExecution.findMany({
    where: { status: 'running', startedAt: { lte: cutoff } },
    orderBy: { startedAt: 'asc' },
    take: 100,
    select: { id: true, taskType: true },
  })
  const interrupted: Array<{
    id: string
    disposition: TaskRecoveryDisposition
  }> = []
  for (const execution of stale) {
    const disposition = interruptedTaskDisposition(execution.taskType)
    const result = await database.scheduledTaskExecution.updateMany({
      where: { id: execution.id, status: 'running' },
      data: {
        status: 'interrupted',
        interruptedAt: now,
        recoveryDisposition: disposition,
        recoveryReason: 'EXECUTION_OWNERSHIP_LOST',
      },
    })
    if (result.count === 1) interrupted.push({ id: execution.id, disposition })
  }
  return interrupted
}
