import {
  findSchoolMembership,
  findStudentAccessForUser,
  hasOrganizationAdminRole,
  mayManageClassSubject,
  mayManageCourseworkAssignment,
  visibleCourseworkAssignmentForStudent,
  type PrismaClient,
} from '@warka/database'
import { eligibleParentChildren } from './parentPortalService.js'
import { prismaDocumentDownloadService } from './documentDownloadService.js'
import { z } from 'zod'

export class FileAssetAccessError extends Error {
  constructor() {
    super('File asset is not available to this user')
  }
}

export async function requireFileAssetAccess(
  database: PrismaClient,
  actorId: string,
  assetId: string,
  action: 'read' | 'manage',
  now = new Date(),
) {
  if (
    !z.uuid().safeParse(actorId).success ||
    !z.uuid().safeParse(assetId).success
  )
    throw new FileAssetAccessError()
  const [actor, asset] = await Promise.all([
    database.user.findUnique({
      where: { id: actorId },
      select: { accountStatus: true },
    }),
    database.fileAsset.findUnique({ where: { id: assetId } }),
  ])
  if (
    actor?.accountStatus !== 'active' ||
    !asset ||
    asset.status !== 'available'
  )
    throw new FileAssetAccessError()
  if (asset.scanRequired) {
    const scan = await database.fileScan.findFirst({
      where: { fileAssetId: asset.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, result: true },
    })
    if (scan?.status !== 'clean' || scan.result !== 'clean')
      throw new FileAssetAccessError()
  }

  if (asset.purpose === 'learningMaterial') {
    if (!asset.learningMaterialId || !asset.schoolId)
      throw new FileAssetAccessError()
    const material = await database.learningMaterial.findUnique({
      where: { id: asset.learningMaterialId },
    })
    if (!material || material.schoolId !== asset.schoolId)
      throw new FileAssetAccessError()
    if (
      await mayManageClassSubject(
        database,
        actorId,
        material.schoolId,
        material.academicYearId,
        material.schoolClassId,
        material.subjectId,
      )
    )
      return asset
    if (
      action === 'manage' ||
      !material.publishedAt ||
      material.publishedAt > now
    )
      throw new FileAssetAccessError()
    const student = await findStudentAccessForUser(database, actorId)
    if (student) {
      const day = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
      const enrollment = await database.enrollment.findFirst({
        where: {
          studentId: student.studentId,
          schoolId: material.schoolId,
          academicYearId: material.academicYearId,
          schoolClassId: material.schoolClassId,
          status: 'approved',
          academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
        },
        select: { id: true },
      })
      if (enrollment) return asset
    }
    const children = await eligibleParentChildren(database, actorId, now).catch(
      () => [],
    )
    if (
      children.some(
        (child) =>
          child.schoolId === material.schoolId &&
          child.academicYearId === material.academicYearId &&
          child.schoolClassId === material.schoolClassId,
      )
    )
      return asset
    throw new FileAssetAccessError()
  }

  if (asset.purpose === 'courseworkAssignment') {
    if (!asset.schoolId) throw new FileAssetAccessError()
    const attachment = await database.courseworkAttachment.findUnique({
      where: { fileAssetId: asset.id },
      include: { assignment: true },
    })
    if (
      !attachment ||
      attachment.removedAt ||
      attachment.schoolId !== asset.schoolId
    )
      throw new FileAssetAccessError()
    if (
      await mayManageCourseworkAssignment(
        database,
        actorId,
        attachment.assignment,
      )
    )
      return asset
    if (
      action !== 'read' ||
      !['published', 'closed'].includes(attachment.assignment.status)
    )
      throw new FileAssetAccessError()
    const visible = await visibleCourseworkAssignmentForStudent(
      database,
      actorId,
      attachment.assignmentId,
      now,
    )
    if (visible) return asset
    throw new FileAssetAccessError()
  }

  if (asset.purpose === 'courseworkSubmission') {
    if (!asset.schoolId) throw new FileAssetAccessError()
    const attachment = await database.submissionAttachment.findUnique({
      where: { fileAssetId: asset.id },
      include: {
        revision: {
          include: { submission: { include: { assignment: true } } },
        },
      },
    })
    if (
      !attachment ||
      attachment.removedAt ||
      attachment.schoolId !== asset.schoolId
    )
      throw new FileAssetAccessError()
    const { revision } = attachment
    const { submission } = revision
    if (submission.schoolId !== asset.schoolId) throw new FileAssetAccessError()
    const own = await visibleCourseworkAssignmentForStudent(
      database,
      actorId,
      submission.assignmentId,
      now,
    )
    if (own?.studentId === submission.studentId) return asset
    if (
      action === 'read' &&
      revision.submittedAt &&
      (await mayManageCourseworkAssignment(
        database,
        actorId,
        submission.assignment,
      ))
    )
      return asset
    throw new FileAssetAccessError()
  }

  if (asset.purpose === 'issuedDocument') {
    if (!asset.issuedDocumentId || !asset.schoolId)
      throw new FileAssetAccessError()
    const document = await database.issuedDocument.findUnique({
      where: { id: asset.issuedDocumentId },
      select: { schoolId: true },
    })
    if (!document || document.schoolId !== asset.schoolId || action !== 'read')
      throw new FileAssetAccessError()
    await prismaDocumentDownloadService(database).find(
      actorId,
      asset.schoolId,
      asset.issuedDocumentId,
    )
    return asset
  }

  if (asset.purpose === 'schoolBranding') {
    if (!asset.schoolId) throw new FileAssetAccessError()
    const school = await database.school.findUnique({
      where: { id: asset.schoolId },
      select: { organizationId: true },
    })
    if (!school) throw new FileAssetAccessError()
    if (
      await hasOrganizationAdminRole(database, actorId, school.organizationId)
    )
      return asset
    const membership = await findSchoolMembership(
      database,
      actorId,
      asset.schoolId,
    )
    if (
      membership?.role === 'administrator' ||
      (action === 'read' && membership?.role === 'registrar')
    )
      return asset
  }
  throw new FileAssetAccessError()
}
