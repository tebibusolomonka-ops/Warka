import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  StudentDocumentsSchema,
  IssuedDocumentSummarySchema,
} from '@warka/shared'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { DocumentManagementService } from './documentManagementService.js'

const studentParams = z.strictObject({
  schoolId: z.uuid(),
  studentId: z.uuid(),
})
const documentParams = z.strictObject({
  schoolId: z.uuid(),
  documentId: z.uuid(),
})
const issueBody = z.strictObject({
  academicYearId: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
})
const reasonBody = z.strictObject({
  reason: z.string().trim().min(3).max(1000),
})

function summary(document: {
  id: string
  documentType: 'reportCard' | 'transcript'
  verificationReference: string
  status: 'active' | 'corrected' | 'withdrawn'
  issuedAt: Date
  supersedesId: string | null
}) {
  return IssuedDocumentSummarySchema.parse({
    id: document.id,
    documentType: document.documentType,
    verificationReference: document.verificationReference,
    status: document.status,
    issuedAt: document.issuedAt.toISOString(),
    supersedesId: document.supersedesId,
  })
}

export function registerDocumentManagementRoutes(
  app: FastifyInstance,
  getDocuments: () => DocumentManagementService,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/students/:studentId/documents',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId, studentId } = studentParams.parse(request.params)
      const result = await getDocuments().list(actor.id, schoolId, studentId)
      return StudentDocumentsSchema.parse({
        documents: result.documents.map(summary),
        eligibleYears: result.eligibleYears,
      })
    },
  )
  app.post(
    '/schools/:schoolId/students/:studentId/documents',
    { preHandler: authenticate },
    async (request, reply) => {
      const actor = authenticatedUser(request)
      const { schoolId, studentId } = studentParams.parse(request.params)
      const { academicYearId, documentType } = issueBody.parse(request.body)
      const document = await getDocuments().issue(
        actor.id,
        schoolId,
        studentId,
        academicYearId,
        documentType,
      )
      return reply.code(201).send(summary(document))
    },
  )
  app.post(
    '/schools/:schoolId/documents/:documentId/correct',
    { preHandler: authenticate },
    async (request, reply) => {
      const actor = authenticatedUser(request)
      const { schoolId, documentId } = documentParams.parse(request.params)
      const { reason } = reasonBody.parse(request.body)
      const document = await getDocuments().correct(
        actor.id,
        schoolId,
        documentId,
        reason,
      )
      return reply.code(201).send(summary(document))
    },
  )
  app.post(
    '/schools/:schoolId/documents/:documentId/withdraw',
    { preHandler: authenticate },
    async (request) => {
      const actor = authenticatedUser(request)
      const { schoolId, documentId } = documentParams.parse(request.params)
      const { reason } = reasonBody.parse(request.body)
      return summary(
        await getDocuments().withdraw(actor.id, schoolId, documentId, reason),
      )
    },
  )
}
