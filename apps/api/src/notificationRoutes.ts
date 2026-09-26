import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const ListQuery = z.strictObject({
  unread: z.enum(['true', 'false']).optional(),
  take: z.coerce.number().int().min(1).max(49).optional(),
  cursor: z.uuid().optional(),
})
const NotificationParams = z.strictObject({ id: z.uuid() })

export function registerNotificationRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get('/notifications', { preHandler: authenticate }, async (request) => {
    const query = ListQuery.parse(request.query)
    const take = query.take ?? 20
    const items = await listNotifications(
      getDatabase(),
      authenticatedUser(request).id,
      {
        unread: query.unread === 'true',
        take: take + 1,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    )
    return {
      items: items.slice(0, take),
      nextCursor: items.length > take ? items[take - 1]!.id : null,
    }
  })
  app.get(
    '/notifications/unread-count',
    { preHandler: authenticate },
    async (request) => ({
      count: await unreadNotificationCount(
        getDatabase(),
        authenticatedUser(request).id,
      ),
    }),
  )
  app.post(
    '/notifications/:id/read',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = NotificationParams.parse(request.params)
      const changed = await markNotificationRead(
        getDatabase(),
        authenticatedUser(request).id,
        id,
      )
      if (!changed)
        return reply.code(404).send({
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: 'Notification not found',
          },
        })
      return { read: true }
    },
  )
  app.post(
    '/notifications/read-all',
    { preHandler: authenticate },
    async (request) => ({
      count: (
        await markAllNotificationsRead(
          getDatabase(),
          authenticatedUser(request).id,
        )
      ).count,
    }),
  )
}
