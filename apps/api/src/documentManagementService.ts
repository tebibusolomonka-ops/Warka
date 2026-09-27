import {
  correctDocument,
  issueDocument,
  listStudentDocuments,
  requireDocumentAuthority,
  withdrawDocument,
  type PrismaClient,
  type DocumentArtifactWriter,
} from '@warka/database'
import { createHash } from 'node:crypto'
import { renderReportCard, renderTranscript } from './documentPdf.js'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'
import type { IssuedDocument } from '@warka/database'

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
  storage?: FileStorage,
): DocumentManagementService {
  async function withArtifact<T>(
    action: (write: DocumentArtifactWriter) => Promise<T>,
  ) {
    const storedKeys: string[] = []
    const write: DocumentArtifactWriter = async (transaction, document) => {
      const target = storage ?? configuredFileStorage()
      storedKeys.push(
        await storeIssuedDocumentArtifact(transaction, target, document),
      )
    }
    try {
      return await action(write)
    } catch (error) {
      if (storedKeys.length) {
        const target = storage ?? configuredFileStorage()
        await Promise.all(
          storedKeys.map((key) => target.delete(key).catch(() => undefined)),
        )
      }
      throw error
    }
  }
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
      return withArtifact((write) =>
        issueDocument(
          database,
          actorId,
          {
            schoolId,
            studentId,
            academicYearId,
            documentType,
          },
          write,
        ),
      )
    },
    correct(actorId, schoolId, documentId, reason) {
      return withArtifact((write) =>
        correctDocument(database, actorId, schoolId, documentId, reason, write),
      )
    },
    withdraw(actorId, schoolId, documentId, reason) {
      return withdrawDocument(database, actorId, schoolId, documentId, reason)
    },
  }
}

export async function storeIssuedDocumentArtifact(
  transaction: Parameters<DocumentArtifactWriter>[0],
  storage: FileStorage,
  document: IssuedDocument,
) {
  const bytes = Buffer.from(
    document.documentType === 'reportCard'
      ? await renderReportCard(document)
      : await renderTranscript(document),
  )
  const stored = await storage.put(bytes)
  try {
    await transaction.fileAsset.create({
      data: {
        schoolId: document.schoolId,
        issuedDocumentId: document.id,
        createdById: document.issuedById,
        purpose: 'issuedDocument',
        status: 'available',
        storageKey: stored.key,
        originalFileName: `warka-${document.documentType === 'reportCard' ? 'report-card' : 'transcript'}-${document.id}.pdf`,
        contentType: 'application/pdf',
        sizeBytes: BigInt(bytes.byteLength),
        checksum: createHash('sha256').update(bytes).digest('hex'),
      },
    })
  } catch (error) {
    await storage.delete(stored.key).catch(() => undefined)
    throw error
  }
  return stored.key
}
