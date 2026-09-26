import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  getSchoolDocumentProfile,
  saveSchoolDocumentProfile,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const Params = z.strictObject({ schoolId: z.uuid() })
export function registerSchoolDocumentProfileRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/document-profile',
    { preHandler: authenticate },
    (request) => {
      const { schoolId } = Params.parse(request.params)
      return getSchoolDocumentProfile(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
  app.put(
    '/schools/:schoolId/document-profile',
    { preHandler: authenticate },
    (request) => {
      const { schoolId } = Params.parse(request.params)
      return saveSchoolDocumentProfile(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        request.body,
      )
    },
  )
}
