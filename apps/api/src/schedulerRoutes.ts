import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { PrismaClient } from '@warka/database'
import { backupDue, recordAuditEvent } from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import { requireOperator } from './operationsAccess.js'
import { BackupScheduler, schedulerConfiguration } from './backupScheduler.js'
import { schedulerHealth } from './schedulerHealth.js'
import { retryEligible } from './schedulerRetry.js'

const idParams = z.strictObject({ id: z.uuid() })

export function registerSchedulerRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  retry: (id: string) => Promise<boolean> = (id) =>
    new BackupScheduler(
      getDatabase(),
      schedulerConfiguration(process.env),
    ).retryExecution(id),
) {
  const operator = async (request: Parameters<preHandlerHookHandler>[0]) =>
    requireOperator(getDatabase(), authenticatedUser(request).id)

  app.get(
    '/operations/scheduler',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return schedulerHealth.snapshot(getDatabase())
    },
  )

  app.get(
    '/operations/scheduler/executions',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const records = await getDatabase().scheduledTaskExecution.findMany({
        orderBy: { scheduledFor: 'desc' },
        take: 50,
        select: {
          id: true,
          taskType: true,
          scope: true,
          scheduledFor: true,
          startedAt: true,
          completedAt: true,
          status: true,
          attempt: true,
          failureCode: true,
          eligibleCount: true,
          oldestEligibleAt: true,
        },
      })
      return records.map((record) => ({
        ...record,
        retryEligible: retryEligible(record),
      }))
    },
  )

  app.get(
    '/operations/scheduler/failures',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().scheduledTaskExecution.findMany({
        where: { status: 'failed' },
        orderBy: { completedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          taskType: true,
          scope: true,
          scheduledFor: true,
          completedAt: true,
          attempt: true,
          failureCode: true,
        },
      })
    },
  )

  app.get(
    '/operations/scheduler/due-backups',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const database = getDatabase()
      const [policy, latest] = await Promise.all([
        database.backupPolicy.findUnique({ where: { id: 'database' } }),
        database.backupRecord.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ])
      return policy
        ? [
            {
              scope: 'database',
              enabled: policy.enabled,
              frequency: policy.frequency,
              verificationRequired: policy.verificationRequired,
              retentionCount: policy.retentionCount,
              due: backupDue(policy, latest?.createdAt ?? null),
            },
          ]
        : []
    },
  )

  app.get(
    '/operations/scheduler/retention-evaluations',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().scheduledTaskExecution.findMany({
        where: { taskType: 'retentionEvaluation', status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          scope: true,
          scheduledFor: true,
          completedAt: true,
          eligibleCount: true,
          oldestEligibleAt: true,
        },
      })
    },
  )

  app.post(
    '/operations/scheduler/executions/:id/retry',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = idParams.parse(request.params)
      const retried = await retry(id)
      if (!retried)
        return reply
          .code(409)
          .send({ error: 'Execution is not eligible for retry' })
      await recordAuditEvent(getDatabase(), {
        actorUserId: authenticatedUser(request).id,
        action: 'scheduler.retryRequested',
        resourceType: 'scheduledTaskExecution',
        resourceId: id,
      })
      return { retried: true }
    },
  )
}
