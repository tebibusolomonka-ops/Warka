import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  getSchoolDocumentProfile,
  saveSchoolDocumentProfile,
  requireSchoolDocumentProfileManager,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import { configuredFileStorage } from './objectFileStorage.js'
import { removeSchoolLogo, uploadSchoolLogo } from './schoolBranding.js'

const Params = z.strictObject({ schoolId: z.uuid() })
const logoBody = z.strictObject({
  originalFileName: z.string().min(1).max(120),
  contentType: z.string().min(1).max(100),
  base64: z
    .string()
    .min(4)
    .max(3_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
})
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
  app.post(
    '/schools/:schoolId/document-profile/logo',
    { preHandler: authenticate, bodyLimit: 3 * 1024 * 1024 },
    async (request, reply) => {
      const { schoolId } = Params.parse(request.params)
      const body = logoBody.parse(request.body)
      const actorId = authenticatedUser(request).id
      await requireSchoolDocumentProfileManager(
        getDatabase(),
        actorId,
        schoolId,
      )
      const result = await uploadSchoolLogo({
        database: getDatabase(),
        storage: configuredFileStorage(),
        actorId,
        schoolId,
        bytes: Buffer.from(body.base64, 'base64'),
        originalFileName: body.originalFileName,
        claimedContentType: body.contentType,
      })
      return reply.code(201).send(result)
    },
  )
  app.delete(
    '/schools/:schoolId/document-profile/logo',
    { preHandler: authenticate },
    (request) => {
      const { schoolId } = Params.parse(request.params)
      return removeSchoolLogo(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
}
