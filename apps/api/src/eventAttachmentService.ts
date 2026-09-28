import {
  enqueueFileScanTask,
  requireSchoolEventManager,
  type PrismaClient,
} from '@warka/database'
import { validateUpload } from './fileValidation.js'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'
import { configuredScannerName } from './fileScannerConfig.js'
import { notifyFileSecurity } from './fileSecurityNotifications.js'

export class EventAttachmentError extends Error {}

export function eventAttachmentService(
  database: PrismaClient,
  storage?: FileStorage,
) {
  async function draft(actorId: string, schoolId: string, eventId: string) {
    await requireSchoolEventManager(database, actorId, schoolId)
    const event = await database.schoolEvent.findFirst({
      where: { id: eventId, schoolId, status: 'draft' },
    })
    if (!event) throw new EventAttachmentError('Draft event required')
  }
  return {
    async upload(
      actorId: string,
      schoolId: string,
      eventId: string,
      file: {
        bytes: Uint8Array
        originalFileName: string
        claimedContentType: string
      },
    ) {
      await draft(actorId, schoolId, eventId)
      const checked = await validateUpload({
        ...file,
        purpose: 'eventAttachment',
      })
      const targetStorage = storage ?? configuredFileStorage()
      const stored = await targetStorage.put(file.bytes)
      try {
        return await database.$transaction(
          async (transaction) => {
            const event = await transaction.schoolEvent.findFirst({
              where: { id: eventId, schoolId, status: 'draft' },
              select: { id: true },
            })
            if (!event) throw new EventAttachmentError('Draft event required')
            const count = await transaction.eventAttachment.count({
              where: { eventId, schoolId, removedAt: null },
            })
            if (count >= 5)
              throw new EventAttachmentError(
                'Five active attachments is the limit',
              )
            const asset = await transaction.fileAsset.create({
              data: {
                schoolId,
                createdById: actorId,
                purpose: 'eventAttachment',
                status: 'pending',
                scanRequired: true,
                storageKey: stored.key,
                originalFileName: checked.originalFileName,
                contentType: checked.contentType,
                sizeBytes: BigInt(checked.sizeBytes),
                checksum: checked.checksum,
              },
            })
            const attachment = await transaction.eventAttachment.create({
              data: {
                schoolId,
                eventId,
                fileAssetId: asset.id,
                createdById: actorId,
              },
            })
            const scan = await transaction.fileScan.create({
              data: {
                fileAssetId: asset.id,
                scanner: configuredScannerName(),
                status: 'pending',
              },
            })
            await enqueueFileScanTask(transaction, scan.id)
            await notifyFileSecurity(transaction, {
              event: 'processing',
              fileAssetId: asset.id,
              ownerUserId: actorId,
              scanId: scan.id,
            })
            return {
              id: attachment.id,
              fileAssetId: asset.id,
              originalFileName: asset.originalFileName,
              status: asset.status,
            }
          },
          { isolationLevel: 'Serializable' },
        )
      } catch (error) {
        await targetStorage.delete(stored.key).catch(() => undefined)
        throw error
      }
    },
    async remove(
      actorId: string,
      schoolId: string,
      eventId: string,
      attachmentId: string,
    ) {
      await draft(actorId, schoolId, eventId)
      const changed = await database.eventAttachment.updateMany({
        where: { id: attachmentId, schoolId, eventId, removedAt: null },
        data: { removedAt: new Date() },
      })
      if (changed.count !== 1)
        throw new EventAttachmentError('Attachment not found')
      return { removed: true }
    },
    async list(actorId: string, schoolId: string, eventId: string) {
      await requireSchoolEventManager(database, actorId, schoolId)
      const event = await database.schoolEvent.findFirst({
        where: { id: eventId, schoolId },
      })
      if (!event) throw new EventAttachmentError('Event not found')
      const rows = await database.eventAttachment.findMany({
        where: { schoolId, eventId, removedAt: null },
        include: {
          fileAsset: {
            select: {
              originalFileName: true,
              contentType: true,
              sizeBytes: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map((row) => ({
        id: row.id,
        originalFileName: row.fileAsset.originalFileName,
        contentType: row.fileAsset.contentType,
        sizeBytes: row.fileAsset.sizeBytes.toString(),
        status: row.fileAsset.status,
      }))
    },
  }
}
