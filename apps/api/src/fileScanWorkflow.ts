import { recordAuditEvent, type PrismaClient } from '@warka/database'
import type { FileScanner, ScanOutcome } from './fileScanner.js'
import type { FileStorage } from './fileStorage.js'

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
  return outcome
}
