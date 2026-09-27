import { recordAuditEvent, type PrismaClient } from '@warka/database'
import type { FileScanner, ScanOutcome } from './fileScanner.js'
import type { FileStorage } from './fileStorage.js'
import { notifyFileSecurity } from './fileSecurityNotifications.js'

export async function processPendingFileScan(input: {
  database: PrismaClient
  storage: FileStorage
  scanner: FileScanner
  scanId: string
}) {
  const { database, storage, scanner, scanId } = input
  const scan = await database.fileScan.findUnique({
    where: { id: scanId },
    include: { fileAsset: true },
  })
  if (
    !scan ||
    scan.status !== 'pending' ||
    scan.fileAsset.status !== 'pending' ||
    !scan.fileAsset.scanRequired
  )
    return { status: 'skipped' as const }
  const claimed = await database.fileScan.updateMany({
    where: { id: scanId, status: 'pending' },
    data: { status: 'scanning', startedAt: new Date() },
  })
  if (claimed.count !== 1) return { status: 'skipped' as const }
  let outcome: ScanOutcome
  try {
    const stored = await storage.get(scan.fileAsset.storageKey)
    outcome = await scanner.scanStream(
      stored.stream as AsyncIterable<Uint8Array>,
    )
  } catch {
    outcome = { status: 'failed', failureCode: 'SCAN_ERROR' }
  }
  await database.$transaction(async (transaction) => {
    const status =
      outcome.status === 'failed'
        ? outcome.failureCode === 'SCANNER_UNAVAILABLE'
          ? 'unavailable'
          : 'failed'
        : outcome.status
    await transaction.fileScan.update({
      where: { id: scanId },
      data: {
        status,
        completedAt: new Date(),
        result: outcome.status === 'failed' ? null : outcome.status,
        failureCode: outcome.status === 'failed' ? outcome.failureCode : null,
      },
    })
    await transaction.fileAsset.updateMany({
      where: { id: scan.fileAssetId, status: 'pending' },
      data: {
        status:
          outcome.status === 'clean'
            ? 'available'
            : outcome.status === 'infected'
              ? 'quarantined'
              : 'pending',
      },
    })
    if (
      outcome.status === 'clean' &&
      scan.fileAsset.purpose === 'learningMaterial' &&
      scan.fileAsset.learningMaterialId
    )
      await transaction.learningMaterial.updateMany({
        where: { id: scan.fileAsset.learningMaterialId, publishedAt: null },
        data: { publishedAt: new Date() },
      })
    if (
      outcome.status === 'clean' &&
      scan.fileAsset.purpose === 'schoolBranding' &&
      scan.fileAsset.schoolId
    ) {
      const latest = await transaction.fileAsset.findFirst({
        where: { schoolId: scan.fileAsset.schoolId, purpose: 'schoolBranding' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      })
      if (latest?.id === scan.fileAssetId) {
        await transaction.schoolDocumentProfile.upsert({
          where: { schoolId: scan.fileAsset.schoolId },
          create: {
            schoolId: scan.fileAsset.schoolId,
            logoAssetId: scan.fileAssetId,
          },
          update: { logoAssetId: scan.fileAssetId },
        })
        await recordAuditEvent(transaction, {
          schoolId: scan.fileAsset.schoolId,
          actorUserId: scan.fileAsset.createdById,
          action: 'schoolDocumentProfile.updated',
          resourceType: 'schoolDocumentProfile',
          resourceId: scan.fileAsset.schoolId,
          metadata: { logoAssetId: scan.fileAssetId },
        })
      }
    }
    if (outcome.status === 'infected')
      await recordAuditEvent(transaction, {
        schoolId: scan.fileAsset.schoolId ?? undefined,
        actorUserId: scan.fileAsset.createdById,
        action: 'fileAsset.quarantined',
        resourceType: 'fileAsset',
        resourceId: scan.fileAssetId,
        metadata: { scanId },
      })
  })
  const event =
    outcome.status === 'infected'
      ? 'quarantined'
      : outcome.status === 'failed'
        ? 'failed'
        : 'rescanComplete'
  await notifyFileSecurity(database, {
    event,
    fileAssetId: scan.fileAssetId,
    ownerUserId:
      scan.fileAsset.purpose === 'learningMaterial'
        ? scan.fileAsset.createdById
        : null,
    scanId,
  }).catch(() => undefined)
  return outcome
}
