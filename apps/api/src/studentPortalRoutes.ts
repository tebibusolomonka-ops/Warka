import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { authenticatedUser } from './authenticateRequest.js'
import type { StudentPortalService } from './studentPortalService.js'

export function registerStudentPortalRoutes(
  app: FastifyInstance,
  getPortal: () => StudentPortalService,
  authenticate: preHandlerHookHandler,
) {
  app.get('/student/results', { preHandler: authenticate }, async (request) =>
    getPortal().results(authenticatedUser(request).id),
  )
  app.get('/student/me', { preHandler: authenticate }, async (request) =>
    getPortal().identity(authenticatedUser(request).id),
  )
}
