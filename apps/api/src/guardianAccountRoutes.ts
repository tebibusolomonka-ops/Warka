import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  ProvisionGuardianAccountSchema,
  type GuardianAccountService,
} from './guardianAccountService.js'

const params = z.strictObject({ schoolId: z.uuid(), guardianId: z.uuid() })

export function registerGuardianAccountRoutes(
  app: FastifyInstance,
  getService: () => GuardianAccountService,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/guardians/:guardianId/access',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, guardianId } = params.parse(request.params)
      return getService().status(
        authenticatedUser(request).id,
        schoolId,
        guardianId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/guardians/:guardianId/access',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, guardianId } = params.parse(request.params)
      const body = ProvisionGuardianAccountSchema.parse(request.body)
      if (body.guardianId !== guardianId) {
        return reply.code(400).send({
          error: {
            code: 'GUARDIAN_MISMATCH',
            message: 'Guardian does not match route',
          },
        })
      }
      return reply
        .code(201)
        .send(
          await getService().create(
            authenticatedUser(request).id,
            schoolId,
            body,
          ),
        )
    },
  )
}
