import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { DocumentSnapshotSchema } from './issuedDocuments.js'
import type { QualityFinding } from './studentDataQuality.js'

export async function checkDocumentDataQuality(
  database: PrismaClient,
  schoolId: string,
): Promise<QualityFinding[]> {
  z.uuid().parse(schoolId)
  const documents = await database.issuedDocument.findMany({
    where: { schoolId },
    include: {
      fileAsset: { select: { id: true, checksum: true, status: true } },
      supersedes: {
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          documentType: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })
  const findings: QualityFinding[] = []
  const references = new Set<string>()
  const add = (id: string, code: string, summary: string) =>
    findings.push({
      category: 'document',
      severity: 'blocking',
      code,
      summary,
      entityType: 'issuedDocument',
      entityId: id,
    })
  for (const document of documents) {
    if (!DocumentSnapshotSchema.safeParse(document.snapshot).success)
      add(
        document.id,
        'DOCUMENT_SNAPSHOT_INVALID',
        'Issued document snapshot is missing or invalid',
      )
    if (!document.verificationReference.trim())
      add(
        document.id,
        'DOCUMENT_VERIFICATION_REFERENCE_MISSING',
        'Verification reference is missing',
      )
    else if (references.has(document.verificationReference))
      add(
        document.id,
        'DOCUMENT_VERIFICATION_REFERENCE_CONFLICT',
        'Verification reference conflicts with another document',
      )
    else references.add(document.verificationReference)
    if (
      document.supersedesId &&
      (!document.supersedes ||
        document.supersedes.schoolId !== schoolId ||
        document.supersedes.studentId !== document.studentId ||
        document.supersedes.documentType !== document.documentType)
    )
      add(
        document.id,
        'DOCUMENT_VERSION_RELATIONSHIP_INVALID',
        'Corrected document version relationship is invalid',
      )
    if (document.status === 'withdrawn' && !document.withdrawnAt)
      add(
        document.id,
        'DOCUMENT_WITHDRAWAL_HISTORY_MISSING',
        'Withdrawn document has no withdrawal timestamp',
      )
    if (
      document.fileAsset?.status === 'available' &&
      !document.fileAsset.checksum.trim()
    )
      add(
        document.id,
        'DOCUMENT_ARTIFACT_CHECKSUM_MISSING',
        'Available document artifact has no checksum',
      )
  }
  return findings
}
