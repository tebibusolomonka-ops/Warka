import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  createSchoolContact,
  deleteSchoolContact,
  listSchoolContacts,
  updateSchoolContact,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const contactParams = z.strictObject({
  schoolId: z.uuid(),
  contactId: z.uuid(),
})
export function registerSchoolContactRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/contacts',
    { preHandler: authenticate },
    (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return listSchoolContacts(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/contacts',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      return reply
        .code(201)
        .send(
          await createSchoolContact(
            getDatabase(),
            authenticatedUser(request).id,
            schoolId,
            request.body,
          ),
        )
    },
  )
  app.put(
    '/schools/:schoolId/contacts/:contactId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, contactId } = contactParams.parse(request.params)
      const result = await updateSchoolContact(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        contactId,
        request.body,
      )
      if (!result)
        return reply
          .code(404)
          .send({
            error: { code: 'CONTACT_NOT_FOUND', message: 'Contact not found' },
          })
      return result
    },
  )
  app.delete(
    '/schools/:schoolId/contacts/:contactId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, contactId } = contactParams.parse(request.params)
      if (
        !(await deleteSchoolContact(
          getDatabase(),
          authenticatedUser(request).id,
          schoolId,
          contactId,
        ))
      )
        return reply
          .code(404)
          .send({
            error: { code: 'CONTACT_NOT_FOUND', message: 'Contact not found' },
          })
      return reply.code(204).send()
    },
  )
}
