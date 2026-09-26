import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  createDocumentRequest,
  listStudentDocumentRequests,
  cancelDocumentRequest,
  findStudentAccessForUser,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const createSchema = z.strictObject({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
})
const paramsSchema = z.strictObject({ requestId: z.uuid() })

export function registerStudentDocumentRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/student/documents',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const database = getDatabase()
      const access = await findStudentAccessForUser(database, actor.id)
      if (!access) return { requests: [], eligibleYears: [] }
      const [requests, enrollments] = await Promise.all([
        listStudentDocumentRequests(database, actor.id),
        database.enrollment.findMany({
          where: {
            studentId: access.studentId,
            status: { in: ['approved', 'withdrawn'] },
          },
          include: { school: true, academicYear: true },
          orderBy: { createdAt: 'desc' },
        }),
      ])
      return {
        requests: requests.map((item) => ({
          id: item.id,
          schoolId: item.schoolId,
          documentType: item.documentType,
          status: item.status,
          requestedAt: item.requestedAt.toISOString(),
          rejectionReason: item.rejectionReason,
          issuedDocumentId: item.issuedDocument?.id ?? null,
          verificationReference:
            item.issuedDocument?.verificationReference ?? null,
        })),
        eligibleYears: enrollments.map((item) => ({
          schoolId: item.schoolId,
          school: item.school.name,
          academicYearId: item.academicYearId,
          academicYear: item.academicYear.name,
        })),
      }
    },
  )
  app.post(
    '/student/documents',
    { preHandler: authenticate },
    async (request, reply) => {
      const actor = authenticatedUser(request)
      const input = createSchema.parse(request.body)
      const access = await findStudentAccessForUser(getDatabase(), actor.id)
      if (!access)
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Student access required' },
        })
      const item = await createDocumentRequest(getDatabase(), actor.id, {
        ...input,
        studentId: access.studentId,
      })
      return reply.code(201).send({ status: item.status })
    },
  )
  app.post(
    '/student/documents/:requestId/cancel',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { requestId } = paramsSchema.parse(request.params)
      const item = await cancelDocumentRequest(
        getDatabase(),
        actor.id,
        requestId,
      )
      return { status: item.status }
    },
  )
}
