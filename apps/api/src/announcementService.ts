import {
  findSchoolMembership,
  findStudentAccessForUser,
  hasOrganizationAdminRole,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'

export const AnnouncementInputSchema = z.strictObject({
  schoolClassId: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  publish: z.boolean().default(true),
  expiresAt: z.iso.datetime().optional(),
})
export type AnnouncementInput = z.input<typeof AnnouncementInputSchema>

export class AnnouncementAccessError extends Error {
  constructor() {
    super('Announcement not found for this user')
  }
}

export type AnnouncementService = {
  create(
    actorId: string,
    schoolId: string,
    input: AnnouncementInput,
  ): Promise<unknown>
  publish(
    actorId: string,
    schoolId: string,
    announcementId: string,
  ): Promise<unknown>
  staffList(actorId: string, schoolId: string): Promise<unknown>
  studentList(userId: string, now?: Date): Promise<unknown>
}

export function prismaAnnouncementService(
  database: PrismaClient,
): AnnouncementService {
  async function role(
    actorId: string,
    schoolId: string,
  ): Promise<'administrator' | 'teacher'> {
    const school = await database.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    })
    if (!school) throw new AnnouncementAccessError()
    if (
      await hasOrganizationAdminRole(database, actorId, school.organizationId)
    )
      return 'administrator'
    const membership = await findSchoolMembership(database, actorId, schoolId)
    if (membership?.role === 'administrator') return 'administrator'
    if (membership?.role === 'teacher') return 'teacher'
    throw new AnnouncementAccessError()
  }

  async function canManage(
    actorId: string,
    schoolId: string,
    schoolClassId: string | null,
    now = new Date(),
  ) {
    const currentRole = await role(actorId, schoolId)
    if (currentRole === 'administrator') {
      if (
        schoolClassId &&
        !(await database.schoolClass.findFirst({
          where: { id: schoolClassId, schoolId },
        }))
      )
        throw new AnnouncementAccessError()
      return
    }
    if (!schoolClassId) throw new AnnouncementAccessError()
    const day = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    const schoolClass = await database.schoolClass.findFirst({
      where: {
        id: schoolClassId,
        schoolId,
        academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
      },
    })
    if (!schoolClass) throw new AnnouncementAccessError()
    const assignment = await database.teachingAssignment.findFirst({
      where: {
        userId: actorId,
        schoolId,
        schoolClassId,
        academicYearId: schoolClass.academicYearId,
      },
      select: { id: true },
    })
    if (!assignment) throw new AnnouncementAccessError()
  }

  return {
    async create(actorId, schoolId, input) {
      const data = AnnouncementInputSchema.parse(input)
      await canManage(actorId, schoolId, data.schoolClassId ?? null)
      return database.announcement.create({
        data: {
          schoolId,
          schoolClassId: data.schoolClassId ?? null,
          title: data.title,
          body: data.body,
          publishedAt: data.publish ? new Date() : null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          createdById: actorId,
        },
      })
    },
    async publish(actorId, schoolId, announcementId) {
      const item = await database.announcement.findFirst({
        where: { id: announcementId, schoolId },
      })
      if (!item) throw new AnnouncementAccessError()
      await canManage(actorId, schoolId, item.schoolClassId)
      return database.announcement.update({
        where: { id: item.id },
        data: { publishedAt: item.publishedAt ?? new Date() },
      })
    },
    async staffList(actorId, schoolId) {
      const currentRole = await role(actorId, schoolId)
      return database.announcement.findMany({
        where: {
          schoolId,
          ...(currentRole === 'teacher'
            ? { createdById: actorId, schoolClassId: { not: null } }
            : {}),
        },
        include: { schoolClass: { select: { name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    },
    async studentList(userId, now = new Date()) {
      const access = await findStudentAccessForUser(database, userId)
      if (!access) throw new AnnouncementAccessError()
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
      if (!enrollment) return []
      const items = await database.announcement.findMany({
        where: {
          schoolId: enrollment.schoolId,
          publishedAt: { lte: now },
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            {
              OR: [
                { schoolClassId: null },
                ...(enrollment.schoolClassId
                  ? [{ schoolClassId: enrollment.schoolClassId }]
                  : []),
              ],
            },
          ],
        },
        include: { schoolClass: { select: { name: true } } },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        publishedAt: item.publishedAt!.toISOString(),
        scope: item.schoolClass
          ? { type: 'class', name: item.schoolClass.name }
          : { type: 'school' },
      }))
    },
  }
}
