import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@warka/database'
import { getParentPortalSetting, setParentPortalEnabled } from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const params = z.strictObject({ schoolId: z.uuid() })
const body = z.strictObject({ parentPortalEnabled: z.boolean() })

export function registerParentServiceRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/parent-portal',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = params.parse(request.params)
      return getParentPortalSetting(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
  app.put(
    '/schools/:schoolId/parent-portal',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = params.parse(request.params)
      const { parentPortalEnabled } = body.parse(request.body)
      const result = await setParentPortalEnabled(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        parentPortalEnabled,
      )
      return {
        parentPortalEnabled: result.parentPortalEnabled,
        enabledAt: result.enabledAt,
      }
    },
  )
}
