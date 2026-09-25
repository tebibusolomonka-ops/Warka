import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import type { ParentAcademicService } from './parentAcademicService.js'
import { authenticatedUser } from './authenticateRequest.js'
import type { ParentPortalService } from './parentPortalService.js'

export function registerParentPortalRoutes(
  app: FastifyInstance,
  getPortal: () => ParentPortalService,
  getAcademic: () => ParentAcademicService,
  authenticate: preHandlerHookHandler,
) {
  app.get('/parent/me', { preHandler: authenticate }, async (request) =>
    getPortal().identity(authenticatedUser(request).id),
  )
  app.get('/parent/children', { preHandler: authenticate }, async (request) =>
    getPortal().children(authenticatedUser(request).id),
  )
  const childParams = z.strictObject({
    studentReference: z.string().min(1).max(100),
  })
  for (const resource of ['results', 'announcements', 'materials'] as const) {
    app.get(
      '/parent/children/:studentReference/' + resource,
      { preHandler: authenticate },
      async (request) => {
        const { studentReference } = childParams.parse(request.params)
        return getAcademic()[resource](
          authenticatedUser(request).id,
          studentReference,
        )
      },
    )
  }
}
