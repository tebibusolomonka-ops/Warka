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
    async coursework(userId: string, studentReference: string) {
      const child = await requireChild(userId, studentReference)
      if (!child.schoolClassId) return []
      const assignments = await database.courseworkAssignment.findMany({
        where: {
          schoolId: child.schoolId,
          academicYearId: child.academicYearId,
          schoolClassId: child.schoolClassId,
          status: { in: ['published', 'closed'] },
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          status: true,
          extensions: {
            where: { studentId: child.studentId },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { extendedDueAt: true },
          },
          submissions: {
            where: { studentId: child.studentId },
            select: {
              status: true,
              submittedAt: true,
              revisions: {
                where: { submittedAt: { not: null } },
                orderBy: { revisionNumber: 'desc' },
                take: 1,
                select: {
                  feedback: {
                    select: { status: true, text: true, releasedAt: true },
                  },
                  rubricScores: {
                    orderBy: { version: 'desc' },
                    take: 1,
                    select: { totalPoints: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 100,
      })
      return assignments.map((assignment) => {
        const submission = assignment.submissions[0]
        const revision = submission?.revisions[0]
        const released =
          revision?.feedback?.status === 'released' &&
          Boolean(revision.feedback.releasedAt)
        return {
          id: assignment.id,
          title: assignment.title,
          status: assignment.status,
          dueAt: (
            assignment.extensions[0]?.extendedDueAt ?? assignment.dueAt
          ).toISOString(),
          submissionStatus: submission?.status ?? 'not_started',
          submittedAt: submission?.submittedAt?.toISOString() ?? null,
          feedback: released ? revision!.feedback!.text : null,
          rubricScore: released
            ? (revision?.rubricScores[0]?.totalPoints.toString() ?? null)
            : null,
        }
      })
    },
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
