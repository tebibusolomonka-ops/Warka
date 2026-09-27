import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'
import { requireOperator } from './operationsAccess.js'
import { maxEmailDeliveryAttempts } from './emailOutboxScheduler.js'

const querySchema = z.strictObject({
  status: z
    .enum(['queued', 'sending', 'sent', 'failed', 'cancelled'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

function maskedAddress(address: string) {
  const [local, domain] = address.split('@')
  return `${local?.slice(0, 1) ?? '*'}***@${domain ?? 'hidden'}`
}

export function registerEmailAdministrationRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const operator = async (request: Parameters<preHandlerHookHandler>[0]) =>
    requireOperator(getDatabase(), authenticatedUser(request).id)

  app.get(
    '/operations/email/deliveries',
    { preHandler: authenticate },
    async (request) => {
      await operator(request)
      const query = querySchema.parse(request.query)
      const deliveries = await getDatabase().emailDelivery.findMany({
        ...(query.status ? { where: { status: query.status } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        select: {
          id: true,
          recipientAddress: true,
          templateKey: true,
          status: true,
          createdAt: true,
          scheduledAt: true,
          attemptCount: true,
          failureCode: true,
          recoveryRequest: { select: { status: true, expiresAt: true } },
        },
      })
      return {
        deliveries: deliveries.map((item) => ({
          id: item.id,
          recipient: maskedAddress(item.recipientAddress),
          templateKey: item.templateKey,
          status: item.status,
          createdAt: item.createdAt,
          scheduledAt: item.scheduledAt,
          attemptCount: item.attemptCount,
          failureCode: item.failureCode,
          retryEligible:
            item.status === 'failed' &&
            item.failureCode === 'UNAVAILABLE' &&
            item.attemptCount < maxEmailDeliveryAttempts &&
            (!item.recoveryRequest ||
              (item.recoveryRequest.status === 'pending' &&
                item.recoveryRequest.expiresAt > new Date())),
        })),
      }
    },
  )

  app.post(
    '/operations/email/deliveries/:id/retry',
    { preHandler: authenticate },
    async (request, reply) => {
      await operator(request)
      const { id } = z.strictObject({ id: z.uuid() }).parse(request.params)
      const database = getDatabase()
      const queued = await database.$transaction(async (transaction) => {
        const delivery = await transaction.emailDelivery.findUnique({
          where: { id },
          select: {
            status: true,
            failureCode: true,
            attemptCount: true,
            recoveryRequest: {
              select: { status: true, expiresAt: true },
            },
            digestId: true,
          },
        })
        if (
          !delivery ||
          delivery.status !== 'failed' ||
          delivery.failureCode !== 'UNAVAILABLE' ||
          delivery.attemptCount >= maxEmailDeliveryAttempts ||
          (delivery.recoveryRequest &&
            (delivery.recoveryRequest.status !== 'pending' ||
              delivery.recoveryRequest.expiresAt <= new Date()))
        )
          return false
        const latest = await transaction.scheduledTaskExecution.findFirst({
          where: { taskType: 'emailDelivery', resourceId: id },
          orderBy: [{ attempt: 'desc' }, { createdAt: 'desc' }],
          select: { seriesId: true, attempt: true, status: true },
        })
        if (!latest || latest.status !== 'failed') return false
        const changed = await transaction.emailDelivery.updateMany({
          where: {
            id,
            status: 'failed',
            failureCode: 'UNAVAILABLE',
            attemptCount: latest.attempt,
          },
          data: {
            status: 'queued',
            scheduledAt: new Date(),
            failedAt: null,
            failureCode: null,
          },
        })
        if (changed.count !== 1) return false
        if (delivery.digestId) {
          const digestReset = await transaction.emailDigest.updateMany({
            where: { id: delivery.digestId, status: 'failed' },
            data: { status: 'queued' },
          })
          if (digestReset.count !== 1)
            throw new Error('Digest retry state is unavailable')
        }
        await transaction.scheduledTaskExecution.create({
          data: {
            taskType: 'emailDelivery',
            scope: 'transactional_email',
            resourceId: id,
            scheduledFor: new Date(),
            status: 'pending',
            seriesId: latest.seriesId,
            attempt: latest.attempt + 1,
          },
        })
        return true
      })
      if (!queued)
        return reply.code(409).send({
          error: {
            code: 'RETRY_NOT_ALLOWED',
            message: 'Delivery is not eligible for retry',
          },
        })
      return reply.code(202).send({ status: 'queued' })
    },
  )
}
