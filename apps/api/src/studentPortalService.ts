import type { PrismaClient } from '@warka/database'
import { findStudentAccessForUser } from '@warka/database'

export class StudentPortalAccessError extends Error {
  constructor() {
    super('Student portal access required')
  }
}

export type StudentIdentity = {
  studentReference: string
  givenName: string
  familyName: string | null
  currentEnrollment: null | {
    school: string
    academicYear: string
    gradeLevel: string
    schoolClass: string | null
  }
}

export type StudentResult = {
  academicYear: string
  gradingPeriod: string
  subject: string
  percentage: number
  gradeLabel: string
  publishedAt: string
  corrected: boolean
}

export type StudentPortalService = {
  results(userId: string): Promise<StudentResult[]>
  identity(userId: string, now?: Date): Promise<StudentIdentity>
}

export function prismaStudentPortalService(
  database: PrismaClient,
): StudentPortalService {
  return {
    async results(userId) {
      const access = await findStudentAccessForUser(database, userId)
      if (!access) throw new StudentPortalAccessError()
      const rows = await database.publishedResult.findMany({
        where: {
          studentId: access.studentId,
          resultSet: { status: 'published' },
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
    async identity(userId, now = new Date()) {
      const access = await findStudentAccessForUser(database, userId)
      if (!access) throw new StudentPortalAccessError()
      const day = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
      const enrollments = await database.enrollment.findMany({
        where: {
          studentId: access.studentId,
          status: 'approved',
          academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
        },
        include: {
          school: true,
          academicYear: true,
          gradeLevel: true,
          schoolClass: true,
        },
        orderBy: [
          { academicYear: { startsOn: 'desc' } },
          { approvedAt: 'desc' },
          { id: 'desc' },
        ],
        take: 1,
      })
      const enrollment = enrollments[0]
      return {
        studentReference: access.student.studentReference,
        givenName: access.student.givenName,
        familyName: access.student.familyName,
        currentEnrollment: enrollment
          ? {
              school: enrollment.school.name,
              academicYear: enrollment.academicYear.name,
              gradeLevel: enrollment.gradeLevel.name,
              schoolClass: enrollment.schoolClass?.name ?? null,
            }
          : null,
      }
    },
  }
}
