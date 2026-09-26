import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  closeSupportRequest,
  createSupportRequest,
  getRoutedSupportRequest,
  listRoutedSupportRequests,
  replyToSupportRequest,
  resolveSupportRequest,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const school = z.strictObject({ schoolId: z.uuid() })
const detail = z.strictObject({ schoolId: z.uuid(), requestId: z.uuid() })
export function registerSupportRequestRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/support-requests',
    { preHandler: authenticate },
    (request) => {
      const { schoolId } = school.parse(request.params)
      return listRoutedSupportRequests(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/support-requests',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      return reply
        .code(201)
        .send(
          await createSupportRequest(
            getDatabase(),
            authenticatedUser(request).id,
            schoolId,
            request.body,
          ),
        )
    },
  )
  app.get(
    '/schools/:schoolId/support-requests/:requestId',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, requestId } = detail.parse(request.params)
      return getRoutedSupportRequest(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        requestId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/support-requests/:requestId/replies',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, requestId } = detail.parse(request.params)
      const { body } = z.strictObject({ body: z.string() }).parse(request.body)
      return replyToSupportRequest(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        requestId,
        body,
      )
    },
  )
  app.post(
    '/schools/:schoolId/support-requests/:requestId/resolve',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, requestId } = detail.parse(request.params)
      const { summary } = z
        .strictObject({ summary: z.string() })
        .parse(request.body)
      return resolveSupportRequest(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        requestId,
        summary,
      )
    },
  )
  app.post(
    '/schools/:schoolId/support-requests/:requestId/close',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, requestId } = detail.parse(request.params)
      return closeSupportRequest(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        requestId,
      )
    },
  )
}
