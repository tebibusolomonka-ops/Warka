import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolMembership } from './schoolMemberships.js'

export const TransferPackageSchema = z.strictObject({
  student: z.strictObject({
    displayName: z.string().min(1),
    studentReference: z.string().min(1),
  }),
  sendingSchool: z.string().min(1),
  sourceAcademicYear: z.string().min(1),
  sourceGradeLevel: z.string().min(1),
  sourceClass: z.string().nullable(),
  sourceEnrollmentStatus: z.literal('approved'),
})
export type TransferPackage = z.infer<typeof TransferPackageSchema>

export const RequestTransferSchema = z.strictObject({
  studentId: z.uuid(),
  sendingSchoolId: z.uuid(),
  receivingSchoolId: z.uuid(),
  sourceEnrollmentId: z.uuid(),
})
export type RequestTransfer = z.infer<typeof RequestTransferSchema>

export class TransferPermissionError extends Error {
  constructor() {
    super('Transfer access denied')
  }
}
export class TransferSourceError extends Error {
  constructor() {
    super('Approved source enrollment required')
  }
}
export class DuplicateActiveTransferError extends Error {
  constructor() {
    super('Student already has an active transfer')
  }
}

export async function requireTransferSchoolRole(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new TransferPermissionError()
  const membership = await findSchoolMembership(database, actorId, schoolId)
  if (
    membership?.role !== 'administrator' &&
    membership?.role !== 'registrar' &&
    membership?.role !== 'approver' &&
    !(await hasOrganizationAdminRole(database, actorId, school.organizationId))
  )
    throw new TransferPermissionError()
}

export async function requestTransfer(
  database: PrismaClient,
  actorId: string,
  input: RequestTransfer,
) {
  const data = RequestTransferSchema.parse(input)
  z.uuid().parse(actorId)
  if (data.sendingSchoolId === data.receivingSchoolId)
    throw new TransferSourceError()
  await requireTransferSchoolRole(database, actorId, data.sendingSchoolId)
  try {
    return await database.$transaction(async (transaction) => {
      const [source, receivingSchool, active] = await Promise.all([
        transaction.enrollment.findFirst({
          where: {
            id: data.sourceEnrollmentId,
            studentId: data.studentId,
            schoolId: data.sendingSchoolId,
            status: 'approved',
          },
          include: {
            student: true,
            school: true,
            academicYear: true,
            gradeLevel: true,
            schoolClass: true,
          },
        }),
        transaction.school.findUnique({
          where: { id: data.receivingSchoolId },
          select: { id: true },
        }),
        transaction.transferRequest.findFirst({
          where: {
            studentId: data.studentId,
            status: { in: ['requested', 'approvedBySendingSchool'] },
          },
          select: { id: true },
        }),
      ])
      if (active) throw new DuplicateActiveTransferError()
      if (!source || !receivingSchool) throw new TransferSourceError()
      const transferPackage = TransferPackageSchema.parse({
        student: {
          displayName: [source.student.givenName, source.student.familyName]
            .filter(Boolean)
            .join(' '),
          studentReference: source.student.studentReference,
        },
        sendingSchool: source.school.name,
        sourceAcademicYear: source.academicYear.name,
        sourceGradeLevel: source.gradeLevel.name,
        sourceClass: source.schoolClass?.name ?? null,
        sourceEnrollmentStatus: source.status,
      })
      return transaction.transferRequest.create({
        data: {
          ...data,
          requestedById: actorId,
          transferPackage: transferPackage as Prisma.InputJsonValue,
        },
      })
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new DuplicateActiveTransferError()
    throw error
  }
}

export async function listSchoolTransfers(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireTransferSchoolRole(database, actorId, schoolId)
  return database.transferRequest.findMany({
    where: {
      OR: [{ sendingSchoolId: schoolId }, { receivingSchoolId: schoolId }],
    },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
  })
}

export async function findTransferForSchool(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  transferId: string,
) {
  await requireTransferSchoolRole(database, actorId, schoolId)
  return database.transferRequest.findFirst({
    where: {
      id: transferId,
      OR: [{ sendingSchoolId: schoolId }, { receivingSchoolId: schoolId }],
    },
  })
}

export type { TransferRequest, TransferStatus } from '@prisma/client'
