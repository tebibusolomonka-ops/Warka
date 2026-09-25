import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { authenticatedUser } from './authenticateRequest.js'
import type { ParentPortalService } from './parentPortalService.js'

export function registerParentPortalRoutes(
  app: FastifyInstance,
  getPortal: () => ParentPortalService,
  authenticate: preHandlerHookHandler,
) {
  app.get('/parent/me', { preHandler: authenticate }, async (request) =>
    getPortal().identity(authenticatedUser(request).id),
  )
  app.get('/parent/children', { preHandler: authenticate }, async (request) =>
    getPortal().children(authenticatedUser(request).id),
  )
}
