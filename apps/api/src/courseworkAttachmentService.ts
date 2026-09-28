import {
  mayManageCourseworkAssignment,
  enqueueFileScanTask,
  type PrismaClient,
} from '@warka/database'
import { validateUpload } from './fileValidation.js'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'
import { configuredScannerName } from './fileScannerConfig.js'
import { notifyFileSecurity } from './fileSecurityNotifications.js'

export class CourseworkAttachmentError extends Error {}

export function courseworkAttachmentService(
  database: PrismaClient,
  storage?: FileStorage,
) {
  async function draftFor(
    actorId: string,
    schoolId: string,
    assignmentId: string,
  ) {
    const assignment = await database.courseworkAssignment.findFirst({
      where: { id: assignmentId, schoolId, status: 'draft' },
    })
    if (
      !assignment ||
      !(await mayManageCourseworkAssignment(database, actorId, assignment))
    )
      throw new CourseworkAttachmentError('Editable assignment required')
    return assignment
  }
  return {
    async upload(
      actorId: string,
      schoolId: string,
      assignmentId: string,
      file: {
        bytes: Uint8Array
        originalFileName: string
        claimedContentType: string
      },
    ) {
      await draftFor(actorId, schoolId, assignmentId)
      const checked = await validateUpload({
        ...file,
        purpose: 'courseworkAssignment',
      })
      const targetStorage = storage ?? configuredFileStorage()
      const stored = await targetStorage.put(file.bytes)
      try {
        return await database.$transaction(
          async (transaction) => {
            const assignment = await transaction.courseworkAssignment.findFirst(
              {
                where: { id: assignmentId, schoolId, status: 'draft' },
                select: { id: true },
              },
            )
            if (!assignment)
              throw new CourseworkAttachmentError(
                'Editable assignment required',
              )
            const count = await transaction.courseworkAttachment.count({
              where: { assignmentId, schoolId, removedAt: null },
            })
            if (count >= 5)
              throw new CourseworkAttachmentError(
                'Five active attachments is the limit',
              )
            const asset = await transaction.fileAsset.create({
              data: {
                schoolId,
                createdById: actorId,
                purpose: 'courseworkAssignment',
                status: 'pending',
                scanRequired: true,
                storageKey: stored.key,
                originalFileName: checked.originalFileName,
                contentType: checked.contentType,
                sizeBytes: BigInt(checked.sizeBytes),
                checksum: checked.checksum,
              },
            })
            const attachment = await transaction.courseworkAttachment.create({
              data: {
                schoolId,
                assignmentId,
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
              contentType: asset.contentType,
              sizeBytes: asset.sizeBytes.toString(),
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
      assignmentId: string,
      attachmentId: string,
    ) {
      await draftFor(actorId, schoolId, assignmentId)
      const changed = await database.courseworkAttachment.updateMany({
        where: { id: attachmentId, schoolId, assignmentId, removedAt: null },
        data: { removedAt: new Date() },
      })
      if (changed.count !== 1)
        throw new CourseworkAttachmentError('Attachment is not active')
      return { removed: true }
    },
    async list(actorId: string, schoolId: string, assignmentId: string) {
      const assignment = await database.courseworkAssignment.findFirst({
        where: { id: assignmentId, schoolId },
      })
      if (
        !assignment ||
        !(await mayManageCourseworkAssignment(database, actorId, assignment))
      )
        throw new CourseworkAttachmentError('Assignment access required')
      const rows = await database.courseworkAttachment.findMany({
        where: { schoolId, assignmentId, removedAt: null },
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
      return rows.map((item) => ({
        id: item.id,
        originalFileName: item.fileAsset.originalFileName,
        contentType: item.fileAsset.contentType,
        sizeBytes: item.fileAsset.sizeBytes.toString(),
        status: item.fileAsset.status,
      }))
    },
  }
}
