import {
  findSchoolMembership,
  findStudentAccessForUser,
  hasOrganizationAdminRole,
  mayManageClassSubject,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'

export const LearningMaterialInputSchema = z.strictObject({
  academicYearId: z.uuid(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  resourceType: z.literal('link'),
  resourceLocation: z
    .url()
    .refine(
      (value) => new URL(value).protocol === 'https:',
      'Resource URL must use HTTPS',
    ),
  publish: z.boolean().default(true),
})
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
  studentList(userId: string, now?: Date): Promise<unknown>
}

export function prismaLearningMaterialService(
  database: PrismaClient,
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
          resourceLocation: data.resourceLocation,
          publishedAt: data.publish ? new Date() : null,
          createdById: actorId,
        },
      })
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
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        resourceType: item.resourceType,
        resourceLocation: item.resourceLocation,
        subject: item.subject.name,
        academicYear: item.academicYear.name,
        publishedAt: item.publishedAt!.toISOString(),
      }))
    },
  }
}
