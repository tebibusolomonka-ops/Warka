import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  recordAuditEvent,
  resolveRecoveryReview,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import { requireOperator } from './operationsAccess.js'
import { evaluateDisasterRecoveryReadiness } from './disasterRecoveryReadiness.js'
import { startupReconciliationStatus } from './startupReconciliation.js'
import { retryDelayMs } from './schedulerRetry.js'
import { runRestoreRehearsal } from './restoreRehearsal.js'
import { LocalBackupStorage } from './backupService.js'

const idParams = z.strictObject({ id: z.uuid() })
const resolveBody = z.strictObject({
  resolution: z.enum([
    'retryApproved',
    'confirmedDelivered',
    'confirmedNotDelivered',
    'rescanApproved',
    'quarantined',
    'verificationRequired',
    'targetReviewed',
    'dismissed',
  ]),
  dismiss: z.boolean().optional(),
})
const rehearsalBody = z.strictObject({ backupId: z.uuid() })

const interruptedFailureCode = {
  retentionEvaluation: 'RETENTION_EVALUATION_FAILED',
  backupVerification: 'VERIFICATION_FAILED',
  fileScan: 'SCAN_ERROR',
} as const

export function registerRecoveryRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  actions: { rehearse?: typeof runRestoreRehearsal } = {},
) {
  const operator = async (request: Parameters<preHandlerHookHandler>[0]) =>
    requireOperator(getDatabase(), authenticatedUser(request).id)

  app.get(
    '/operations/recovery',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return {
        startup: startupReconciliationStatus.snapshot(),
        disasterRecovery: await evaluateDisasterRecoveryReadiness({
          database: getDatabase(),
        }),
      }
    },
  )

  app.get(
    '/operations/recovery/executions',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().scheduledTaskExecution.findMany({
        where: { status: 'interrupted' },
        orderBy: { interruptedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          taskType: true,
          scope: true,
          resourceId: true,
          attempt: true,
          startedAt: true,
          interruptedAt: true,
          claimedAt: true,
          heartbeatAt: true,
          leaseExpiresAt: true,
          recoveryDisposition: true,
          recoveryReason: true,
        },
      })
    },
  )

  app.post(
    '/operations/recovery/executions/:id/retry',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const database = getDatabase()
      const { id } = idParams.parse(request.params)
      const execution = await database.scheduledTaskExecution.findUnique({
        where: { id },
        select: { taskType: true, attempt: true, recoveryDisposition: true },
      })
      if (
        !execution ||
        execution.recoveryDisposition !== 'safeToRetry' ||
        !(execution.taskType in interruptedFailureCode)
      )
        return reply.code(409).send({ error: 'Execution is not safe to retry' })
      const completedAt = new Date(
        Date.now() - retryDelayMs(execution.attempt) - 1,
      )
      const changed = await database.scheduledTaskExecution.updateMany({
        where: {
          id,
          status: 'interrupted',
          recoveryDisposition: 'safeToRetry',
        },
        data: {
          status: 'failed',
          completedAt,
          failureCode:
            interruptedFailureCode[
              execution.taskType as keyof typeof interruptedFailureCode
            ],
        },
      })
      if (changed.count !== 1)
        return reply.code(409).send({ error: 'Execution state changed' })
      await recordAuditEvent(database, {
        actorUserId: authenticatedUser(request).id,
        action: 'scheduler.retryRequested',
        resourceType: 'scheduledTaskExecution',
        resourceId: id,
        metadata: { reason: 'interruptedSafeRetry' },
      })
      return { id, status: 'retryRequested' }
    },
  )

  app.get(
    '/operations/recovery/reviews',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      return getDatabase().recoveryReview.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          domain: true,
          resourceType: true,
          resourceReference: true,
          reasonCode: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          resolution: true,
        },
      })
    },
  )

  app.post(
    '/operations/recovery/reviews/:id/resolve',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const database = getDatabase()
      const actorUserId = authenticatedUser(request).id
      const body = resolveBody.parse(request.body)
      const review = await resolveRecoveryReview(database, {
        id: idParams.parse(request.params).id,
        actorUserId,
        resolution: body.resolution,
        ...(body.dismiss === undefined ? {} : { dismiss: body.dismiss }),
      })
      if (
        review.domain === 'emailDelivery' &&
        body.resolution === 'confirmedDelivered'
      )
        await database.emailDelivery.updateMany({
          where: {
            id: review.resourceReference,
            status: 'deliveryUnknown',
          },
          data: { status: 'sent', sentAt: new Date(), failureCode: null },
        })
      if (
        review.domain === 'emailDelivery' &&
        body.resolution === 'confirmedNotDelivered'
      )
        await database.emailDelivery.updateMany({
          where: {
            id: review.resourceReference,
            status: 'deliveryUnknown',
          },
          data: { status: 'failed', failureCode: 'NOT_DELIVERED' },
        })
      return {
        id: review.id,
        status: review.status,
        resolution: review.resolution,
      }
    },
  )

  app.post(
    '/operations/recovery/rehearsals',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const actorId = authenticatedUser(request).id
      const result = await (actions.rehearse ?? runRestoreRehearsal)({
        database: getDatabase(),
        backupId: rehearsalBody.parse(request.body).backupId,
        actorId,
        databaseUrl: process.env.DATABASE_URL ?? '',
        storage: new LocalBackupStorage(process.env.BACKUP_STORAGE_DIR ?? ''),
      })
      await recordAuditEvent(getDatabase(), {
        actorUserId: actorId,
        action: 'backup.rehearsed',
        resourceType: 'restoreRehearsal',
        resourceId: result.id,
        metadata: { passed: result.passed },
      })
      return result
    },
  )
}
