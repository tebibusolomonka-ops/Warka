import {
  recordAuditEvent,
  requireSchoolDocumentProfileManager,
  type PrismaClient,
} from '@warka/database'
import type { FileStorage } from './fileStorage.js'
import { validateUpload } from './fileValidation.js'

export async function uploadSchoolLogo(input: {
  database: PrismaClient
  storage: FileStorage
  actorId: string
  schoolId: string
  bytes: Uint8Array
  originalFileName: string
  claimedContentType: string
}) {
  await requireSchoolDocumentProfileManager(
    input.database,
    input.actorId,
    input.schoolId,
  )
  const checked = await validateUpload({
    bytes: input.bytes,
    originalFileName: input.originalFileName,
    claimedContentType: input.claimedContentType,
    purpose: 'schoolBranding',
  })
  const stored = await input.storage.put(input.bytes)
  try {
    return await input.database.$transaction(async (transaction) => {
      const asset = await transaction.fileAsset.create({
        data: {
          schoolId: input.schoolId,
          createdById: input.actorId,
          purpose: 'schoolBranding',
          status: 'available',
          storageKey: stored.key,
          originalFileName: checked.originalFileName,
          contentType: checked.contentType,
          sizeBytes: BigInt(checked.sizeBytes),
          checksum: checked.checksum,
        },
      })
      await transaction.schoolDocumentProfile.upsert({
        where: { schoolId: input.schoolId },
        create: { schoolId: input.schoolId, logoAssetId: asset.id },
        update: { logoAssetId: asset.id },
      })
      await recordAuditEvent(transaction, {
        schoolId: input.schoolId,
        actorUserId: input.actorId,
        action: 'schoolDocumentProfile.updated',
        resourceType: 'schoolDocumentProfile',
        resourceId: input.schoolId,
        metadata: { logoAssetId: asset.id },
      })
      return {
        id: asset.id,
        originalFileName: asset.originalFileName,
        sizeBytes: asset.sizeBytes.toString(),
      }
    })
  } catch {
    await input.storage.delete(stored.key).catch(() => undefined)
    throw new Error('School logo could not be recorded')
  }
}

export async function removeSchoolLogo(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireSchoolDocumentProfileManager(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const profile = await transaction.schoolDocumentProfile.findUnique({
      where: { schoolId },
      select: { logoAssetId: true },
    })
    if (!profile?.logoAssetId) return { removed: false }
    await transaction.schoolDocumentProfile.update({
      where: { schoolId },
      data: { logoAssetId: null },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolDocumentProfile.updated',
      resourceType: 'schoolDocumentProfile',
      resourceId: schoolId,
      metadata: { logoRemoved: true },
    })
    return { removed: true }
  })
}
