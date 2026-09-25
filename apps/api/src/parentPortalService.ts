import type { PrismaClient } from '@warka/database'

export class ParentPortalAccessError extends Error {
  constructor() {
    super('Parent portal access required')
  }
}

export type ParentChild = {
  studentReference: string
  displayName: string
  schoolId: string
  school: string
  academicYear: string
  gradeLevel: string
  schoolClass: string | null
  relationship: string
}

export type EligibleParentChild = ParentChild & {
  studentId: string
  guardianId: string
  academicYearId: string
  schoolClassId: string | null
}

export async function resolveParentGuardian(
  database: PrismaClient,
  userId: string,
) {
  const access = await database.guardianAccess.findUnique({
    where: { userId },
    include: { guardian: true },
  })
  if (!access) throw new ParentPortalAccessError()
  return access.guardian
}

export async function eligibleParentChildren(
  database: PrismaClient,
  userId: string,
  now = new Date(),
): Promise<EligibleParentChild[]> {
  const guardian = await resolveParentGuardian(database, userId)
  const day = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const links = await database.studentGuardian.findMany({
    where: {
      guardianId: guardian.id,
      verificationStatus: 'verified',
      verificationSchoolId: { not: null },
    },
    include: { student: true },
  })
  const children = await Promise.all(
    links.map(async (link) => {
      const schoolId = link.verificationSchoolId!
      const [setting, enrollment] = await Promise.all([
        database.schoolServiceAccess.findUnique({ where: { schoolId } }),
        database.enrollment.findFirst({
          where: {
            schoolId,
            studentId: link.studentId,
            status: 'approved',
            academicYear: {
              startsOn: { lte: day },
              endsOn: { gte: day },
            },
          },
          include: {
            school: true,
            academicYear: true,
            gradeLevel: true,
            schoolClass: true,
          },
          orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
        }),
      ])
      if (!setting?.parentPortalEnabled || !enrollment) return null
      return {
        studentId: link.studentId,
        guardianId: guardian.id,
        studentReference: link.student.studentReference,
        displayName: [link.student.givenName, link.student.familyName]
          .filter(Boolean)
          .join(' '),
        schoolId,
        school: enrollment.school.name,
        academicYear: enrollment.academicYear.name,
        academicYearId: enrollment.academicYearId,
        gradeLevel: enrollment.gradeLevel.name,
        schoolClass: enrollment.schoolClass?.name ?? null,
        schoolClassId: enrollment.schoolClassId,
        relationship: link.relationship,
      }
    }),
  )
  return children
    .filter((child): child is EligibleParentChild => child !== null)
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.school.localeCompare(b.school),
    )
}

export type ParentPortalService = {
  identity(userId: string): Promise<{ displayName: string }>
  children(userId: string): Promise<ParentChild[]>
}

export function prismaParentPortalService(
  database: PrismaClient,
): ParentPortalService {
  return {
    async identity(userId) {
      const guardian = await resolveParentGuardian(database, userId)
      return { displayName: guardian.name }
    },
    async children(userId) {
      const children = await eligibleParentChildren(database, userId)
      return children.map((child) => ({
        studentReference: child.studentReference,
        displayName: child.displayName,
        schoolId: child.schoolId,
        school: child.school,
        academicYear: child.academicYear,
        gradeLevel: child.gradeLevel,
        schoolClass: child.schoolClass,
        relationship: child.relationship,
      }))
    },
  }
}
