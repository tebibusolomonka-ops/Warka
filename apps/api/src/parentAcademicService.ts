import type { PrismaClient } from '@warka/database'
import { eligibleParentChildren } from './parentPortalService.js'

export class ParentChildNotFoundError extends Error {
  constructor() {
    super('Child is not available in the parent portal')
  }
}

export function prismaParentAcademicService(database: PrismaClient) {
  async function requireChild(userId: string, studentReference: string) {
    const children = await eligibleParentChildren(database, userId)
    const child = children.find(
      (item) => item.studentReference === studentReference,
    )
    if (!child) throw new ParentChildNotFoundError()
    return child
  }
  return {
    async results(userId: string, studentReference: string) {
      const child = await requireChild(userId, studentReference)
      const rows = await database.publishedResult.findMany({
        where: {
          studentId: child.studentId,
          schoolId: child.schoolId,
          resultSet: { status: 'published', publishedAt: { not: null } },
        },
        include: {
          resultSet: {
            include: { academicYear: true, gradingPeriod: true, subject: true },
          },
          corrections: { select: { id: true }, take: 1 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map((row) => ({
        academicYear: row.resultSet.academicYear.name,
        gradingPeriod: row.resultSet.gradingPeriod.name,
        subject: row.resultSet.subject.name,
        percentage: row.currentPercentage.toNumber(),
        gradeLabel: row.currentGradeLabel,
        publishedAt: row.resultSet.publishedAt!.toISOString(),
        corrected: row.corrections.length > 0,
      }))
    },
    async announcements(
      userId: string,
      studentReference: string,
      now = new Date(),
    ) {
      const child = await requireChild(userId, studentReference)
      const rows = await database.announcement.findMany({
        where: {
          schoolId: child.schoolId,
          publishedAt: { lte: now },
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            {
              OR: [
                { schoolClassId: null },
                ...(child.schoolClassId
                  ? [{ schoolClassId: child.schoolClassId }]
                  : []),
              ],
            },
          ],
        },
        include: { schoolClass: { select: { name: true } } },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        publishedAt: row.publishedAt!.toISOString(),
        scope: row.schoolClass
          ? { type: 'class', name: row.schoolClass.name }
          : { type: 'school' },
      }))
    },
    async materials(
      userId: string,
      studentReference: string,
      now = new Date(),
    ) {
      const child = await requireChild(userId, studentReference)
      if (!child.schoolClassId) return []
      const rows = await database.learningMaterial.findMany({
        where: {
          schoolId: child.schoolId,
          academicYearId: child.academicYearId,
          schoolClassId: child.schoolClassId,
          publishedAt: { lte: now },
        },
        include: { subject: { select: { name: true } } },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        resourceType: row.resourceType,
        resourceLocation: row.resourceLocation,
        subject: row.subject.name,
        academicYear: child.academicYear,
        publishedAt: row.publishedAt!.toISOString(),
      }))
    },
  }
}

export type ParentAcademicService = ReturnType<
  typeof prismaParentAcademicService
>
