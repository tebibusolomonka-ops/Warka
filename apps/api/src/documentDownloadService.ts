import {
  effectiveMembershipWhere,
  findStudentAccessForUser,
  recordAuditEvent,
  type IssuedDocument,
  type PrismaClient,
} from '@warka/database'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'

export class DocumentDownloadDeniedError extends Error {
  constructor() {
    super('Document download denied')
  }
}

export type DocumentDownloadService = {
  find(
    actorId: string,
    schoolId: string,
    documentId: string,
  ): Promise<IssuedDocument>
  artifact?(
    documentId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; sizeBytes: number } | null>
}

export function prismaDocumentDownloadService(
  database: PrismaClient,
  storage?: FileStorage,
): DocumentDownloadService {
  return {
    async artifact(documentId) {
      const asset = await database.fileAsset.findUnique({
        where: { issuedDocumentId: documentId },
      })
      if (!asset) return null
      if (asset.status !== 'available') throw new DocumentDownloadDeniedError()
      return (storage ?? configuredFileStorage()).get(asset.storageKey)
    },
    async find(actorId, schoolId, documentId) {
      const document = await database.issuedDocument.findFirst({
        where: { id: documentId, schoolId },
      })
      if (!document) throw new DocumentDownloadDeniedError()
      const student = await findStudentAccessForUser(database, actorId)
      if (student?.studentId === document.studentId) return document
      const staff = await database.schoolMembership.findUnique({
        where: {
          ...effectiveMembershipWhere(),
          userId_schoolId: { userId: actorId, schoolId },
        },
      })
      if (
        !staff ||
        !['administrator', 'approver', 'registrar'].includes(staff.role)
      )
        throw new DocumentDownloadDeniedError()
      await recordAuditEvent(database, {
        schoolId,
        actorUserId: actorId,
        action: 'document.downloaded',
        resourceType: 'issuedDocument',
        resourceId: document.id,
        metadata: { documentType: document.documentType },
      })
      return document
    },
  }
}
