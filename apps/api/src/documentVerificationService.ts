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
          documentType: snapshot.data.documentType,
          issuingSchool: snapshot.data.issuingSchool,
          student: snapshot.data.student,
          issuedAt: snapshot.data.issuedAt,
          academicYear: snapshot.data.academicYear,
          subjects: snapshot.data.subjects.map((item) => ({
            subject: item.subject,
            gradingPeriod: item.gradingPeriod,
            ...(item.academicYear ? { academicYear: item.academicYear } : {}),
            percentage: item.percentage,
            gradeLabel: item.gradeLabel,
          })),
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
