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

export type StudentPortalService = {
  identity(userId: string, now?: Date): Promise<StudentIdentity>
}

export function prismaStudentPortalService(
  database: PrismaClient,
): StudentPortalService {
  return {
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
