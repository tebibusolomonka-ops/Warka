import {
  enqueueFileScanTask,
  effectiveCourseworkDueAt,
  visibleCourseworkAssignmentForStudent,
  type PrismaClient,
} from '@warka/database'
import { validateUpload } from './fileValidation.js'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'
import { configuredScannerName } from './fileScannerConfig.js'
import { notifyFileSecurity } from './fileSecurityNotifications.js'

export class SubmissionAttachmentError extends Error {}

export function submissionAttachmentService(
  database: PrismaClient,
  storage?: FileStorage,
) {
  async function editableRevision(
    actorId: string,
    schoolId: string,
    assignmentId: string,
    revisionId: string,
    now: Date,
  ) {
    const audience = await visibleCourseworkAssignmentForStudent(
      database,
      actorId,
      assignmentId,
      now,
    )
    if (
      !audience ||
      audience.assignment.status !== 'published' ||
      audience.assignment.schoolId !== schoolId ||
      (await effectiveCourseworkDueAt(
        database,
        audience.assignment,
        audience.studentId,
      )) < now
    )
      throw new SubmissionAttachmentError(
        'Assignment is not open to this student',
      )
    const revision = await database.submissionRevision.findUnique({
      where: { id: revisionId },
      include: { submission: true },
    })
    if (
      !revision ||
      revision.submittedAt ||
      revision.submission.assignmentId !== assignmentId ||
      revision.submission.studentId !== audience.studentId ||
      revision.submission.status === 'withdrawn'
    )
      throw new SubmissionAttachmentError('Editable own revision required')
    return revision
  }
  return {
    async upload(
      actorId: string,
      schoolId: string,
      assignmentId: string,
      revisionId: string,
      file: {
        bytes: Uint8Array
        originalFileName: string
        claimedContentType: string
      },
      now = new Date(),
    ) {
      await editableRevision(actorId, schoolId, assignmentId, revisionId, now)
      const checked = await validateUpload({
        ...file,
        purpose: 'courseworkSubmission',
      })
      const targetStorage = storage ?? configuredFileStorage()
      const stored = await targetStorage.put(file.bytes)
      try {
        return await database.$transaction(
          async (transaction) => {
            const revision = await transaction.submissionRevision.findUnique({
              where: { id: revisionId },
              include: { submission: true },
            })
            if (
              !revision ||
              revision.submittedAt ||
              revision.submission.assignmentId !== assignmentId ||
              revision.submission.schoolId !== schoolId ||
              revision.submission.status === 'withdrawn'
            )
              throw new SubmissionAttachmentError(
                'Editable own revision required',
              )
            const count = await transaction.submissionAttachment.count({
              where: { revisionId, removedAt: null },
            })
            if (count >= 5)
              throw new SubmissionAttachmentError(
                'Five active attachments is the limit',
              )
            const asset = await transaction.fileAsset.create({
              data: {
                schoolId,
                createdById: actorId,
                purpose: 'courseworkSubmission',
                status: 'pending',
                scanRequired: true,
                storageKey: stored.key,
                originalFileName: checked.originalFileName,
                contentType: checked.contentType,
                sizeBytes: BigInt(checked.sizeBytes),
                checksum: checked.checksum,
              },
            })
            const attachment = await transaction.submissionAttachment.create({
              data: { schoolId, revisionId, fileAssetId: asset.id },
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
      revisionId: string,
      attachmentId: string,
      now = new Date(),
    ) {
      await editableRevision(actorId, schoolId, assignmentId, revisionId, now)
      const changed = await database.submissionAttachment.updateMany({
        where: { id: attachmentId, revisionId, schoolId, removedAt: null },
        data: { removedAt: now },
      })
      if (!changed.count)
        throw new SubmissionAttachmentError('Active attachment required')
      return { removed: true }
    },
  }
}
