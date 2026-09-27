import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const querySchema = z.strictObject({
  take: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
})

const labels: Record<string, string> = {
  accountRecovery: 'Account recovery',
  passwordChanged: 'Password change',
  accountSuspended: 'Account suspension',
  accountReactivated: 'Account reactivation',
  notificationUpdate: 'Warka update',
  notificationDigest: 'Update digest',
}

export function registerCommunicationDeliveryRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/me/email-deliveries',
    { preHandler: authenticate },
    async (request) => {
      const query = querySchema.parse(request.query)
      const deliveries = await getDatabase().emailDelivery.findMany({
        where: { recipientUserId: authenticatedUser(request).id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.take + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          templateKey: true,
          status: true,
          createdAt: true,
          sentAt: true,
        },
      })
      const page = deliveries.slice(0, query.take)
      return {
        deliveries: page.map((item) => ({
          id: item.id,
          kind: labels[item.templateKey] ?? 'Warka message',
          status:
            item.status === 'sending'
              ? 'queued'
              : item.status === 'cancelled'
                ? 'failed'
                : item.status,
          createdAt: item.createdAt,
          sentAt: item.sentAt,
        })),
        nextCursor:
          deliveries.length > query.take ? (page.at(-1)?.id ?? null) : null,
      }
    },
  )
}
