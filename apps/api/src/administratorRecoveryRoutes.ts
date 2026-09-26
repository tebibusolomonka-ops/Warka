import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { assistAccountRecovery, type PrismaClient } from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

export type AssistedRecovery = typeof assistAccountRecovery

export function registerAdministratorRecoveryRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  delivery?: (email: string, token: string) => Promise<void>,
  assistedRecovery: AssistedRecovery = assistAccountRecovery,
) {
  app.post(
    '/schools/:schoolId/users/:userId/assist-recovery',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, userId } = z
        .strictObject({ schoolId: z.uuid(), userId: z.uuid() })
        .parse(request.params)
      if (!delivery)
        return reply.code(503).send({
          error: {
            code: 'RECOVERY_DELIVERY_UNAVAILABLE',
            message: 'Recovery delivery is unavailable',
          },
        })
      const result = await assistedRecovery(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        userId,
      )
      await delivery(result.email, result.token)
      return reply.code(202).send({ status: 'requested' })
    },
  )
}
