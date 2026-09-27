import type { PrismaClient, ScheduledTaskType } from '@prisma/client'

export async function startScheduledTask(
  database: PrismaClient,
  taskType: ScheduledTaskType,
  scope: string,
  scheduledFor: Date,
  resourceId?: string,
  attempt = 1,
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
