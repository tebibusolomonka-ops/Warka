import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  AnnouncementInputSchema,
  type AnnouncementService,
} from './announcementService.js'

const schoolParams = z.object({ schoolId: z.uuid() })
const announcementParams = schoolParams.extend({ announcementId: z.uuid() })

export function registerAnnouncementRoutes(
  app: FastifyInstance,
  getAnnouncements: () => AnnouncementService,
  authenticate: preHandlerHookHandler,
) {
  app.post(
    '/schools/:schoolId/announcements',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const input = AnnouncementInputSchema.parse(request.body)
      return reply
        .code(201)
        .send(
          await getAnnouncements().create(
            authenticatedUser(request).id,
            schoolId,
            input,
          ),
        )
    },
  )
  app.get(
    '/schools/:schoolId/announcements',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAnnouncements().staffList(
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/announcements/:announcementId/publish',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, announcementId } = announcementParams.parse(
        request.params,
      )
      return getAnnouncements().publish(
        authenticatedUser(request).id,
        schoolId,
        announcementId,
      )
    },
  )
  app.get(
    '/student/announcements',
    { preHandler: authenticate },
    async (request) =>
      getAnnouncements().studentList(authenticatedUser(request).id),
  )
}
