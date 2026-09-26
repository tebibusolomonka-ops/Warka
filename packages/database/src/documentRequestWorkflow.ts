import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import {
  createDocumentInTransaction,
  DocumentReasonSchema,
  requireDocumentAuthority,
} from './issuedDocuments.js'
import {
  DocumentRequestPermissionError,
  DocumentRequestStateError,
  requireDocumentRequestStaff,
} from './documentRequests.js'

export async function startDocumentRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
) {
  z.uuid().parse(requestId)
  await requireDocumentRequestStaff(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const changed = await transaction.documentRequest.updateMany({
      where: { id: requestId, schoolId, status: 'requested' },
      data: { status: 'processing', processingAt: new Date() },
    })
    if (changed.count !== 1) throw new DocumentRequestStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'documentRequest.processing',
      resourceType: 'documentRequest',
      resourceId: requestId,
    })
    return transaction.documentRequest.findUniqueOrThrow({
      where: { id: requestId },
    })
  })
}

export async function issueRequestedDocument(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
) {
  z.uuid().parse(requestId)
  await requireDocumentAuthority(database, actorId, schoolId)
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.documentRequest.findFirst({
        where: { id: requestId, schoolId },
      })
      if (!request) throw new DocumentRequestPermissionError()
      if (request.status !== 'processing') throw new DocumentRequestStateError()
      const document = await createDocumentInTransaction(transaction, actorId, {
        schoolId,
        studentId: request.studentId,
        academicYearId: request.academicYearId,
        documentType: request.documentType,
      })
      const changed = await transaction.documentRequest.updateMany({
        where: {
          id: requestId,
          schoolId,
          status: 'processing',
          issuedDocumentId: null,
        },
        data: {
          status: 'ready',
          readyAt: new Date(),
          issuedDocumentId: document.id,
        },
      })
      if (changed.count !== 1) throw new DocumentRequestStateError()
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'documentRequest.issued',
        resourceType: 'documentRequest',
        resourceId: requestId,
        metadata: { documentType: request.documentType },
      })
      return transaction.documentRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { issuedDocument: true },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function rejectDocumentRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
  reason: string,
) {
  z.uuid().parse(requestId)
  const rejectionReason = DocumentReasonSchema.parse(reason)
  await requireDocumentAuthority(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const changed = await transaction.documentRequest.updateMany({
      where: {
        id: requestId,
        schoolId,
        status: { in: ['requested', 'processing'] },
      },
      data: { status: 'rejected', rejectedAt: new Date(), rejectionReason },
    })
    if (changed.count !== 1) throw new DocumentRequestStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'documentRequest.rejected',
      resourceType: 'documentRequest',
      resourceId: requestId,
    })
    return transaction.documentRequest.findUniqueOrThrow({
      where: { id: requestId },
    })
  })
}
