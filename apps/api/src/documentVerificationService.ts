import {
  DocumentSnapshotSchema,
  findDocumentByReference,
  type PrismaClient,
  type VerificationResultStatus,
} from '@warka/database'
import {
  DocumentVerificationSchema,
  type DocumentVerification,
} from '@warka/shared'

export type DocumentVerificationService = {
  verify(reference: string): Promise<DocumentVerification>
}

export function prismaDocumentVerificationService(
  database: PrismaClient,
): DocumentVerificationService {
  return {
    async verify(reference) {
      const document = await findDocumentByReference(database, reference)
      let status: VerificationResultStatus = document?.status ?? 'unavailable'
      if (document?.status === 'active') {
        const snapshot = DocumentSnapshotSchema.safeParse(document.snapshot)
        if (!snapshot.success) status = 'unavailable'
        await database.verificationEvent.create({
          data: {
            issuedDocumentId: document.id,
            schoolId: document.schoolId,
            resultStatus: status,
          },
        })
        if (!snapshot.success) return { status: 'unavailable' }
        return DocumentVerificationSchema.parse({
          status: 'active',
          ...snapshot.data,
        })
      }
      await database.verificationEvent.create({
        data: {
          resultStatus: status,
          ...(document
            ? { issuedDocumentId: document.id, schoolId: document.schoolId }
            : {}),
        },
      })
      if (!document) return { status: 'unavailable' }
      return DocumentVerificationSchema.parse({ status: document.status })
    },
  }
}
