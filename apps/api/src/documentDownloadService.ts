import {
  findStudentAccessForUser,
  recordAuditEvent,
  type IssuedDocument,
  type PrismaClient,
} from '@warka/database'

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
}

export function prismaDocumentDownloadService(
  database: PrismaClient,
): DocumentDownloadService {
  return {
    async find(actorId, schoolId, documentId) {
      const document = await database.issuedDocument.findFirst({
        where: { id: documentId, schoolId },
      })
      if (!document) throw new DocumentDownloadDeniedError()
      const student = await findStudentAccessForUser(database, actorId)
      if (student?.studentId === document.studentId) return document
      const staff = await database.schoolMembership.findUnique({
        where: { userId_schoolId: { userId: actorId, schoolId } },
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
