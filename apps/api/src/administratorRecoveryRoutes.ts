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
      const result = await assistedRecovery(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        userId,
      )
      reply.header('Cache-Control', 'private, no-store')
      if (delivery) {
        await delivery(result.email, result.token)
        return reply.code(202).send({ status: 'requested' })
      }
      return reply
        .code(202)
        .send({ status: 'temporarySetup', recoveryToken: result.token })
    },
  )
}
