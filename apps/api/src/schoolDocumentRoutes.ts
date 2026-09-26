import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  listSchoolDocumentRequests,
  getDocumentRequest,
  startDocumentRequest,
  issueRequestedDocument,
  rejectDocumentRequest,
  listSchoolDocuments,
  requireDocumentRequestStaff,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const requestParams = z.strictObject({
  schoolId: z.uuid(),
  requestId: z.uuid(),
})
const reasonSchema = z.strictObject({
  reason: z.string().trim().min(3).max(1000),
})

function requestSummary(item: Awaited<ReturnType<typeof getDocumentRequest>>) {
  return {
    id: item.id,
    student: [item.student.givenName, item.student.familyName]
      .filter(Boolean)
      .join(' '),
    studentReference: item.student.studentReference,
    documentType: item.documentType,
    academicYear: item.academicYear.name,
    status: item.status,
    requestedAt: item.requestedAt.toISOString(),
    rejectionReason: item.rejectionReason,
    issuedDocumentId: item.issuedDocumentId,
    verificationReference: item.issuedDocument?.verificationReference ?? null,
  }
}

export function registerSchoolDocumentRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/document-requests',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId } = schoolParams.parse(request.params)
      const status = (request.query as { status?: string }).status
      const items = await listSchoolDocumentRequests(
        getDatabase(),
        actor.id,
        schoolId,
        status,
      )
      return { requests: items.map(requestSummary) }
    },
  )
  app.get(
    '/schools/:schoolId/document-requests/:requestId',
    { preHandler: authenticate },
    async (request, reply) => {
      const actor = authenticatedUser(request)
      const { schoolId, requestId } = requestParams.parse(request.params)
      const item = await getDocumentRequest(getDatabase(), actor.id, requestId)
      if (item.schoolId !== schoolId)
        return reply.code(404).send({
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document request not found',
          },
        })
      return requestSummary(item)
    },
  )
  app.post(
    '/schools/:schoolId/document-requests/:requestId/start',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId, requestId } = requestParams.parse(request.params)
      await startDocumentRequest(getDatabase(), actor.id, schoolId, requestId)
      return { status: 'processing' }
    },
  )
  app.post(
    '/schools/:schoolId/document-requests/:requestId/issue',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId, requestId } = requestParams.parse(request.params)
      const item = await issueRequestedDocument(
        getDatabase(),
        actor.id,
        schoolId,
        requestId,
      )
      return {
        status: item.status,
        verificationReference: item.issuedDocument?.verificationReference,
      }
    },
  )
  app.post(
    '/schools/:schoolId/document-requests/:requestId/reject',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId, requestId } = requestParams.parse(request.params)
      const { reason } = reasonSchema.parse(request.body)
      const item = await rejectDocumentRequest(
        getDatabase(),
        actor.id,
        schoolId,
        requestId,
        reason,
      )
      return { status: item.status }
    },
  )
  app.get(
    '/schools/:schoolId/issued-documents',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId } = schoolParams.parse(request.params)
      await requireDocumentRequestStaff(getDatabase(), actor.id, schoolId)
      const items = await listSchoolDocuments(getDatabase(), schoolId)
      return {
        documents: items.map((item) => ({
          id: item.id,
          documentType: item.documentType,
          status: item.status,
          issuedAt: item.issuedAt.toISOString(),
          verificationReference: item.verificationReference,
          supersedesId: item.supersedesId,
          studentId: item.studentId,
        })),
      }
    },
  )
}
