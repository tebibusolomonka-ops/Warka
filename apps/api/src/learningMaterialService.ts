import {
  findSchoolMembership,
  findStudentAccessForUser,
  hasOrganizationAdminRole,
  mayManageClassSubject,
  enqueueFileScanTask,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { validateUpload } from './fileValidation.js'
import { configuredFileStorage } from './objectFileStorage.js'
import type { FileStorage } from './fileStorage.js'
import { configuredScannerName } from './fileScannerConfig.js'
import { notifyFileSecurity } from './fileSecurityNotifications.js'

const materialContext = {
  academicYearId: z.uuid(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
}
export const LearningMaterialInputSchema = z.discriminatedUnion(
  'resourceType',
  [
    z.strictObject({
      ...materialContext,
      resourceType: z.literal('link'),
      resourceLocation: z
        .url()
        .refine(
          (value) => new URL(value).protocol === 'https:',
          'Resource URL must use HTTPS',
        ),
      publish: z.boolean().default(true),
    }),
    z.strictObject({
      ...materialContext,
      resourceType: z.literal('file'),
      publish: z.literal(false).default(false),
    }),
  ],
)
export type LearningMaterialInput = z.input<typeof LearningMaterialInputSchema>

export class LearningMaterialAccessError extends Error {
  constructor() {
    super('Learning material not found for this user')
  }
}

export type LearningMaterialService = {
  create(
    actorId: string,
    schoolId: string,
    input: LearningMaterialInput,
  ): Promise<unknown>
  staffList(actorId: string, schoolId: string): Promise<unknown>
  publish(
    actorId: string,
    schoolId: string,
    materialId: string,
  ): Promise<unknown>
  upload(
    actorId: string,
    schoolId: string,
    materialId: string,
    file: {
      bytes: Uint8Array
      originalFileName: string
      claimedContentType: string
    },
  ): Promise<unknown>
  studentList(userId: string, now?: Date): Promise<unknown>
}

export function prismaLearningMaterialService(
  database: PrismaClient,
  storage?: FileStorage,
): LearningMaterialService {
  async function role(
    actorId: string,
    schoolId: string,
  ): Promise<'administrator' | 'teacher'> {
    const school = await database.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    })
    if (!school) throw new LearningMaterialAccessError()
    if (
      await hasOrganizationAdminRole(database, actorId, school.organizationId)
    )
      return 'administrator'
    const membership = await findSchoolMembership(database, actorId, schoolId)
    if (membership?.role === 'administrator') return 'administrator'
    if (membership?.role === 'teacher') return 'teacher'
    throw new LearningMaterialAccessError()
  }

  async function canManage(
    actorId: string,
    schoolId: string,
    context: {
      academicYearId: string
      schoolClassId: string
      subjectId: string
    },
  ) {
    const currentRole = await role(actorId, schoolId)
    if (currentRole === 'administrator') return
    if (
      !(await mayManageClassSubject(
        database,
        actorId,
        schoolId,
        context.academicYearId,
        context.schoolClassId,
        context.subjectId,
      ))
    )
      throw new LearningMaterialAccessError()
  }

  return {
    async create(actorId, schoolId, input) {
      const data = LearningMaterialInputSchema.parse(input)
      await canManage(actorId, schoolId, data)
      const [year, schoolClass, subject] = await Promise.all([
        database.academicYear.findFirst({
          where: { id: data.academicYearId, schoolId },
          select: { id: true },
        }),
        database.schoolClass.findFirst({
          where: {
            id: data.schoolClassId,
            schoolId,
            academicYearId: data.academicYearId,
          },
          select: { id: true },
        }),
        database.subject.findFirst({
          where: { id: data.subjectId, schoolId },
          select: { id: true },
        }),
      ])
      if (!year || !schoolClass || !subject)
        throw new LearningMaterialAccessError()
      return database.learningMaterial.create({
        data: {
          schoolId,
          academicYearId: data.academicYearId,
          schoolClassId: data.schoolClassId,
          subjectId: data.subjectId,
          title: data.title,
          description: data.description ?? null,
          resourceType: data.resourceType,
          resourceLocation:
            data.resourceType === 'link' ? data.resourceLocation : '',
          publishedAt:
            data.resourceType === 'link' && data.publish ? new Date() : null,
          createdById: actorId,
        },
      })
    },
    async upload(actorId, schoolId, materialId, file) {
      const material = await database.learningMaterial.findFirst({
        where: { id: materialId, schoolId },
        include: { fileAsset: { select: { id: true } } },
      })
      if (!material || material.resourceType !== 'file' || material.fileAsset)
        throw new LearningMaterialAccessError()
      await canManage(actorId, schoolId, material)
      const checked = await validateUpload({
        ...file,
        purpose: 'learningMaterial',
      })
      const targetStorage = storage ?? configuredFileStorage()
      const stored = await targetStorage.put(file.bytes)
      try {
        const asset = await database.$transaction(async (transaction) => {
          const created = await transaction.fileAsset.create({
            data: {
              schoolId,
              learningMaterialId: material.id,
              createdById: actorId,
              purpose: 'learningMaterial',
              status: 'pending',
              scanRequired: true,
              storageKey: stored.key,
              originalFileName: checked.originalFileName,
              contentType: checked.contentType,
              sizeBytes: BigInt(checked.sizeBytes),
              checksum: checked.checksum,
            },
          })
          const scan = await transaction.fileScan.create({
            data: {
              fileAssetId: created.id,
              scanner: configuredScannerName(),
              status: 'pending',
            },
          })
          await enqueueFileScanTask(transaction, scan.id)
          await notifyFileSecurity(transaction, {
            event: 'processing',
            fileAssetId: created.id,
            ownerUserId: actorId,
            scanId: scan.id,
          })
          return created
        })
        return { ...asset, sizeBytes: asset.sizeBytes.toString() }
      } catch {
        await targetStorage.delete(stored.key).catch(() => undefined)
        throw new Error('Learning material file could not be recorded')
      }
    },
    async staffList(actorId, schoolId) {
      const currentRole = await role(actorId, schoolId)
      return database.learningMaterial.findMany({
        where: {
          schoolId,
          ...(currentRole === 'teacher' ? { createdById: actorId } : {}),
        },
        include: {
          academicYear: { select: { name: true } },
          schoolClass: { select: { name: true } },
          subject: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    },
    async publish(actorId, schoolId, materialId) {
      const item = await database.learningMaterial.findFirst({
        where: { id: materialId, schoolId },
      })
      if (!item) throw new LearningMaterialAccessError()
      await canManage(actorId, schoolId, item)
      if (item.resourceType === 'file') {
        const asset = await database.fileAsset.findUnique({
          where: { learningMaterialId: item.id },
          select: { status: true },
        })
        if (asset?.status !== 'available')
          throw new LearningMaterialAccessError()
      }
      return database.learningMaterial.update({
        where: { id: item.id },
        data: { publishedAt: item.publishedAt ?? new Date() },
      })
    },
    async studentList(userId, now = new Date()) {
      const access = await findStudentAccessForUser(database, userId)
      if (!access) throw new LearningMaterialAccessError()
      const day = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
      const enrollment = await database.enrollment.findFirst({
        where: {
          studentId: access.studentId,
          status: 'approved',
          academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
        },
        orderBy: [
          { academicYear: { startsOn: 'desc' } },
          { approvedAt: 'desc' },
          { id: 'desc' },
        ],
      })
      if (!enrollment?.schoolClassId) return []
      const items = await database.learningMaterial.findMany({
        where: {
          schoolId: enrollment.schoolId,
          academicYearId: enrollment.academicYearId,
          schoolClassId: enrollment.schoolClassId,
          publishedAt: { lte: now },
        },
        include: {
          subject: { select: { name: true } },
          academicYear: { select: { name: true } },
          fileAsset: { select: { id: true, status: true } },
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
      return items
        .filter(
          (item) =>
            item.resourceType !== 'file' ||
            item.fileAsset?.status === 'available',
        )
        .map((item) => ({
          id: item.id,
          schoolId: item.schoolId,
          title: item.title,
          description: item.description,
          resourceType: item.resourceType,
          resourceLocation: item.resourceLocation,
          assetId:
            item.fileAsset?.status === 'available' ? item.fileAsset.id : null,
          subject: item.subject.name,
          academicYear: item.academicYear.name,
          publishedAt: item.publishedAt!.toISOString(),
        }))
    },
  }
}
