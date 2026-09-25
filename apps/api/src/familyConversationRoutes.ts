import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import {
  CreateFamilyConversationSchema,
  FamilyConversationAccessError,
  FamilyMessageBodySchema,
  type FamilyConversationService,
} from './familyConversationService.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const schoolConversationParams = z.strictObject({
  schoolId: z.uuid(),
  conversationId: z.uuid(),
})
const conversationParams = z.strictObject({ conversationId: z.uuid() })
const childParams = z.strictObject({
  studentReference: z.string().min(1).max(100),
})
const page = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
const messageBody = z.strictObject({ body: FamilyMessageBodySchema })

function summary(row: {
  id: string
  route: string
  status: string
  createdAt: Date
  updatedAt: Date
  escalatedAt: Date | null
  student: {
    studentReference: string
    givenName: string
    familyName: string | null
  }
  school?: { name: string }
  messages: { body: string; createdAt: Date }[]
}) {
  return {
    id: row.id,
    studentReference: row.student.studentReference,
    studentName: [row.student.givenName, row.student.familyName]
      .filter(Boolean)
      .join(' '),
    school: row.school?.name ?? null,
    route: row.route,
    status: row.status,
    escalatedAt: row.escalatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessage: row.messages[0]
      ? {
          body: row.messages[0].body,
          createdAt: row.messages[0].createdAt.toISOString(),
        }
      : null,
  }
}

function detail(
  result: Awaited<ReturnType<FamilyConversationService['read']>>,
) {
  return {
    id: result.conversation.id,
    route: result.conversation.route,
    status: result.conversation.status,
    escalatedAt: result.conversation.escalatedAt?.toISOString() ?? null,
    createdAt: result.conversation.createdAt.toISOString(),
    messages: result.messages.map((message) => ({
      id: message.id,
      body: message.body,
      sender: message.senderKind,
      createdAt: message.createdAt.toISOString(),
    })),
  }
}

export function registerFamilyConversationRoutes(
  app: FastifyInstance,
  getService: () => FamilyConversationService,
  authenticate: preHandlerHookHandler,
) {
  async function requireSchoolConversation(
    actorId: string,
    schoolId: string,
    conversationId: string,
  ) {
    const result = await getService().read(actorId, conversationId, 1, 0)
    if (result.conversation.schoolId !== schoolId)
      throw new FamilyConversationAccessError()
    return result
  }
  app.get(
    '/parent/children/:studentReference/teacher-contacts',
    { preHandler: authenticate },
    async (request) => {
      const { studentReference } = childParams.parse(request.params)
      return getService().teacherContacts(
        authenticatedUser(request).id,
        studentReference,
      )
    },
  )
  app.get(
    '/parent/conversations',
    { preHandler: authenticate },
    async (request) => {
      const { limit, offset } = page.parse(request.query)
      const rows = await getService().listGuardian(
        authenticatedUser(request).id,
        limit,
        offset,
      )
      return rows.map(summary)
    },
  )
  app.post(
    '/parent/conversations',
    { preHandler: authenticate },
    async (request, reply) => {
      const input = CreateFamilyConversationSchema.parse(request.body)
      const conversation = await getService().create(
        authenticatedUser(request).id,
        input,
      )
      return reply.code(201).send({
        id: conversation.id,
        route: conversation.route,
        status: conversation.status,
      })
    },
  )
  app.get(
    '/parent/conversations/:conversationId',
    { preHandler: authenticate },
    async (request) => {
      const { conversationId } = conversationParams.parse(request.params)
      const { limit, offset } = page.parse(request.query)
      return detail(
        await getService().read(
          authenticatedUser(request).id,
          conversationId,
          limit,
          offset,
        ),
      )
    },
  )
  app.post(
    '/parent/conversations/:conversationId/messages',
    { preHandler: authenticate },
    async (request, reply) => {
      const { conversationId } = conversationParams.parse(request.params)
      const { body } = messageBody.parse(request.body)
      const message = await getService().send(
        authenticatedUser(request).id,
        conversationId,
        body,
      )
      return reply.code(201).send({
        id: message.id,
        body: message.body,
        sender: message.senderKind,
        createdAt: message.createdAt.toISOString(),
      })
    },
  )
  app.get(
    '/schools/:schoolId/family-conversations',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const { limit, offset } = page.parse(request.query)
      const rows = await getService().listSchool(
        authenticatedUser(request).id,
        schoolId,
        limit,
        offset,
      )
      return rows.map(summary)
    },
  )
  app.get(
    '/schools/:schoolId/family-conversations/:conversationId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, conversationId } = schoolConversationParams.parse(
        request.params,
      )
      const { limit, offset } = page.parse(request.query)
      await requireSchoolConversation(
        authenticatedUser(request).id,
        schoolId,
        conversationId,
      )
      return detail(
        await getService().read(
          authenticatedUser(request).id,
          conversationId,
          limit,
          offset,
        ),
      )
    },
  )
  app.post(
    '/schools/:schoolId/family-conversations/:conversationId/messages',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, conversationId } = schoolConversationParams.parse(
        request.params,
      )
      const { body } = messageBody.parse(request.body)
      const actorId = authenticatedUser(request).id
      await requireSchoolConversation(actorId, schoolId, conversationId)
      const message = await getService().send(actorId, conversationId, body)
      return reply.code(201).send({
        id: message.id,
        body: message.body,
        sender: message.senderKind,
        createdAt: message.createdAt.toISOString(),
      })
    },
  )
  app.post(
    '/schools/:schoolId/family-conversations/:conversationId/close',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, conversationId } = schoolConversationParams.parse(
        request.params,
      )
      const actorId = authenticatedUser(request).id
      await requireSchoolConversation(actorId, schoolId, conversationId)
      const conversation = await getService().close(actorId, conversationId)
      return { id: conversation.id, status: conversation.status }
    },
  )
  app.post(
    '/schools/:schoolId/family-conversations/:conversationId/escalate',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, conversationId } = schoolConversationParams.parse(
        request.params,
      )
      const actorId = authenticatedUser(request).id
      await requireSchoolConversation(actorId, schoolId, conversationId)
      const conversation = await getService().escalate(actorId, conversationId)
      return {
        id: conversation.id,
        escalatedAt: conversation.escalatedAt?.toISOString() ?? null,
      }
    },
  )
}
