import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  DigestCadenceSchema,
  NotificationCategorySchema,
  digestCategories,
  getNotificationPreferences,
  setNotificationPreference,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const updateBody = z.strictObject({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  digestCadence: DigestCadenceSchema.default('off'),
})

export function registerCommunicationPreferenceRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/me/notification-preferences',
    { preHandler: authenticate },
    async (request) => ({
      preferences: await getNotificationPreferences(
        getDatabase(),
        authenticatedUser(request).id,
      ),
    }),
  )

  app.put(
    '/me/notification-preferences/:category',
    { preHandler: authenticate },
    async (request, reply) => {
      const { category } = z
        .strictObject({ category: NotificationCategorySchema })
        .parse(request.params)
      const input = updateBody.parse(request.body)
      if (
        (category === 'accountSecurity' && !input.inAppEnabled) ||
        (input.digestCadence !== 'off' &&
          (!input.emailEnabled ||
            !digestCategories.includes(
              category as (typeof digestCategories)[number],
            )))
      )
        return reply.code(400).send({
          error: {
            code: 'INVALID_PREFERENCE',
            message: 'This notification setting is not supported',
          },
        })
      await setNotificationPreference(
        getDatabase(),
        authenticatedUser(request).id,
        category,
        input,
      )
      return {
        preferences: await getNotificationPreferences(
          getDatabase(),
          authenticatedUser(request).id,
        ),
      }
    },
  )
}
