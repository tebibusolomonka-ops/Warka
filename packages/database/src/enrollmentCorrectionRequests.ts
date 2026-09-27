import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolMembership } from './schoolMemberships.js'

export const EnrollmentCorrectionInputSchema = z.strictObject({
  proposedGradeLevelId: z.uuid(),
  proposedSchoolClassId: z.uuid().nullable(),
  reason: z.string().trim().min(3).max(500),
})

export class EnrollmentCorrectionPermissionError extends Error {
  constructor() {
    super('Enrollment correction permission denied')
  }
}
export class EnrollmentCorrectionStateError extends Error {
  constructor() {
    super('Enrollment correction conflicts with official placement')
  }
}

export async function createEnrollmentCorrectionRequest(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  enrollmentId: string,
  input: unknown,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  z.uuid().parse(enrollmentId)
  const data = EnrollmentCorrectionInputSchema.parse(input)
  const school = await database.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new EnrollmentCorrectionPermissionError()
  const [organizationAdmin, member] = await Promise.all([
    hasOrganizationAdminRole(database, actorUserId, school.organizationId),
    findSchoolMembership(database, actorUserId, schoolId),
  ])
  if (
    !organizationAdmin &&
    !['administrator', 'registrar'].includes(member?.role ?? '')
  )
    throw new EnrollmentCorrectionPermissionError()
  const enrollment = await database.enrollment.findFirst({
    where: { id: enrollmentId, schoolId, status: 'approved' },
  })
  if (!enrollment) throw new EnrollmentCorrectionPermissionError()
  const [grade, schoolClass] = await Promise.all([
    database.gradeLevel.findFirst({
      where: { id: data.proposedGradeLevelId, schoolId },
      select: { id: true },
    }),
    data.proposedSchoolClassId
      ? database.schoolClass.findFirst({
          where: {
            id: data.proposedSchoolClassId,
            schoolId,
            academicYearId: enrollment.academicYearId,
            gradeLevelId: data.proposedGradeLevelId,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  if (!grade || (data.proposedSchoolClassId && !schoolClass))
    throw new EnrollmentCorrectionStateError()
  if (
    enrollment.gradeLevelId === data.proposedGradeLevelId &&
    enrollment.schoolClassId === data.proposedSchoolClassId
  )
    throw new EnrollmentCorrectionStateError()
  try {
    return await database.enrollmentCorrectionRequest.create({
      data: {
        enrollmentId,
        schoolId,
        academicYearId: enrollment.academicYearId,
        previousGradeLevelId: enrollment.gradeLevelId,
        previousSchoolClassId: enrollment.schoolClassId,
        proposedGradeLevelId: data.proposedGradeLevelId,
        proposedSchoolClassId: data.proposedSchoolClassId,
        reason: data.reason,
        requestedById: actorUserId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new EnrollmentCorrectionStateError()
    throw error
  }
}
