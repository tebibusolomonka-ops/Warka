import {
  correctDocument,
  issueDocument,
  listStudentDocuments,
  requireDocumentAuthority,
  withdrawDocument,
  type PrismaClient,
} from '@warka/database'

export class DocumentStudentNotFoundError extends Error {
  constructor() {
    super('Student record not found at this school')
  }
}

export type DocumentManagementService = {
  list(
    actorId: string,
    schoolId: string,
    studentId: string,
  ): Promise<{
    documents: Awaited<ReturnType<typeof listStudentDocuments>>
    eligibleYears: { id: string; name: string }[]
  }>
  issue(
    actorId: string,
    schoolId: string,
    studentId: string,
    academicYearId: string,
    documentType: 'reportCard' | 'transcript',
  ): ReturnType<typeof issueDocument>
  correct(
    actorId: string,
    schoolId: string,
    documentId: string,
    reason: string,
  ): ReturnType<typeof correctDocument>
  withdraw(
    actorId: string,
    schoolId: string,
    documentId: string,
    reason: string,
  ): ReturnType<typeof withdrawDocument>
}

export function prismaDocumentManagementService(
  database: PrismaClient,
): DocumentManagementService {
  return {
    async list(actorId, schoolId, studentId) {
      await requireDocumentAuthority(database, actorId, schoolId)
      const enrollment = await database.enrollment.findFirst({
        where: { schoolId, studentId },
        select: { id: true },
      })
      if (!enrollment) throw new DocumentStudentNotFoundError()
      const [documents, results] = await Promise.all([
        listStudentDocuments(database, schoolId, studentId),
        database.publishedResult.findMany({
          where: {
            schoolId,
            studentId,
            resultSet: { status: 'published', publishedAt: { not: null } },
            enrollment: { status: { in: ['approved', 'withdrawn'] } },
          },
          select: {
            resultSet: {
              select: {
                academicYear: { select: { id: true, name: true } },
              },
            },
          },
        }),
      ])
      const years = new Map<string, string>()
      for (const result of results)
        years.set(
          result.resultSet.academicYear.id,
          result.resultSet.academicYear.name,
        )
      return {
        documents,
        eligibleYears: [...years].map(([id, name]) => ({ id, name })),
      }
    },
    async issue(actorId, schoolId, studentId, academicYearId, documentType) {
      return issueDocument(database, actorId, {
        schoolId,
        studentId,
        academicYearId,
        documentType,
      })
    },
    correct(actorId, schoolId, documentId, reason) {
      return correctDocument(database, actorId, schoolId, documentId, reason)
    },
    withdraw(actorId, schoolId, documentId, reason) {
      return withdrawDocument(database, actorId, schoolId, documentId, reason)
    },
  }
}
