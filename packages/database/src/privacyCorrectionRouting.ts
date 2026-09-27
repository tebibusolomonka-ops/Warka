import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { notifyPrivacyRequester } from './privacyNotifications.js'
import { StudentCorrectionInputSchema } from './studentCorrectionRequests.js'
import {
  PrivacyPermissionError,
  privacyRequesterScope,
} from './privacyRequests.js'
import { requirePrivacyReviewer } from './privacyReviewAccess.js'

export class PrivacyCorrectionStateError extends Error {
  constructor() {
    super('Privacy correction is not ready for routing')
  }
}

export async function routePrivacyCorrection(
  database: PrismaClient,
  actorUserId: string,
  requestId: string,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(requestId)
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.privacyRequest.findUnique({
        where: { id: requestId },
      })
      if (!request || request.type !== 'correction')
        throw new PrivacyPermissionError()
      const access = await requirePrivacyReviewer(
        transaction,
        actorUserId,
        request.schoolId,
      )
      if (request.officialCorrectionRequestId)
        return transaction.studentCorrectionRequest.findUniqueOrThrow({
          where: { id: request.officialCorrectionRequestId },
        })
      if (request.status !== 'approved' || !request.correctionField)
        throw new PrivacyCorrectionStateError()
      const kind = await privacyRequesterScope(
        transaction,
        request.requesterUserId,
        request.studentId,
        request.schoolId,
      )
      if (kind !== request.requesterKind) throw new PrivacyPermissionError()
      const input = StudentCorrectionInputSchema.parse({
        field: request.correctionField,
        proposedValue: request.correctionValue,
        reason: request.details,
      })
      const student = await transaction.student.findFirst({
        where: {
          id: request.studentId,
          enrollments: { some: { schoolId: request.schoolId } },
        },
      })
      if (!student) throw new PrivacyPermissionError()
      const previousValue =
        input.field === 'dateOfBirth'
          ? (student.dateOfBirth?.toISOString().slice(0, 10) ?? null)
          : student[input.field]
      if (previousValue === input.proposedValue)
        throw new PrivacyCorrectionStateError()
      const correction = await transaction.studentCorrectionRequest.create({
        data: {
          schoolId: request.schoolId,
          studentId: request.studentId,
          field: input.field,
          previousValue,
          proposedValue: input.proposedValue,
          reason: input.reason,
          requestedById: actorUserId,
        },
      })
      await transaction.privacyRequest.update({
        where: { id: requestId },
        data: { officialCorrectionRequestId: correction.id },
      })
      await recordAuditEvent(transaction, {
        organizationId: access.organizationId,
        schoolId: request.schoolId,
        actorUserId,
        action: 'privacyCorrection.routed',
        resourceType: 'privacyRequest',
        resourceId: requestId,
        metadata: { correctionRequestId: correction.id },
      })
      await notifyPrivacyRequester(
        transaction,
        request.requesterUserId,
        requestId,
        'correctionRouted',
      )
      return correction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
