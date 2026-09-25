import {
  DocumentSnapshotSchema,
  findDocumentByReference,
  type PrismaClient,
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
      if (!document) return { status: 'unavailable' }
      if (document.status !== 'active')
        return DocumentVerificationSchema.parse({ status: document.status })
      const snapshot = DocumentSnapshotSchema.safeParse(document.snapshot)
      if (!snapshot.success) return { status: 'unavailable' }
      return DocumentVerificationSchema.parse({
        status: 'active',
        ...snapshot.data,
      })
    },
  }
}
