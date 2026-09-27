import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolMembership } from './schoolMemberships.js'

export const StudentCorrectionInputSchema = z
  .strictObject({
    field: z.enum(['givenName', 'familyName', 'dateOfBirth']),
    proposedValue: z.string().trim().max(100).nullable(),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((value, context) => {
    if (value.field === 'givenName' && !value.proposedValue)
      context.addIssue({
        code: 'custom',
        path: ['proposedValue'],
        message: 'Given name is required',
      })
    if (value.field === 'familyName' && value.proposedValue === '')
      context.addIssue({
        code: 'custom',
        path: ['proposedValue'],
        message: 'Use null to clear family name',
      })
    if (
      value.field === 'dateOfBirth' &&
      value.proposedValue !== null &&
      !z.iso.date().safeParse(value.proposedValue).success
    )
      context.addIssue({
        code: 'custom',
        path: ['proposedValue'],
        message: 'Date must be YYYY-MM-DD',
      })
  })

export class StudentCorrectionPermissionError extends Error {
  constructor() {
    super('Student correction permission denied')
  }
}
export class StudentCorrectionStateError extends Error {
  constructor() {
    super('Student correction request conflicts with official state')
  }
}

export async function createStudentCorrectionRequest(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  studentId: string,
  input: unknown,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  z.uuid().parse(studentId)
  const data = StudentCorrectionInputSchema.parse(input)
  const school = await database.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new StudentCorrectionPermissionError()
  const [organizationAdmin, member] = await Promise.all([
    hasOrganizationAdminRole(database, actorUserId, school.organizationId),
    findSchoolMembership(database, actorUserId, schoolId),
  ])
  if (
    !organizationAdmin &&
    !['administrator', 'registrar'].includes(member?.role ?? '')
  )
    throw new StudentCorrectionPermissionError()
  const student = await database.student.findFirst({
    where: { id: studentId, enrollments: { some: { schoolId } } },
  })
  if (!student) throw new StudentCorrectionPermissionError()
  const previousValue =
    data.field === 'dateOfBirth'
      ? (student.dateOfBirth?.toISOString().slice(0, 10) ?? null)
      : student[data.field]
  if (previousValue === data.proposedValue)
    throw new StudentCorrectionStateError()
  try {
    return await database.studentCorrectionRequest.create({
      data: {
        studentId,
        schoolId,
        field: data.field,
        previousValue,
        proposedValue: data.proposedValue,
        reason: data.reason,
        requestedById: actorUserId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new StudentCorrectionStateError()
    throw error
  }
}
