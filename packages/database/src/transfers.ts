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

export class TransferStateError extends Error {
  constructor() {
    super('Transfer is not in the required state')
  }
}
export class TransferDestinationError extends Error {
  constructor() {
    super('Receiving enrollment structure is invalid')
  }
}

export const AcceptTransferSchema = z.strictObject({
  academicYearId: z.uuid(),
  gradeLevelId: z.uuid(),
  schoolClassId: z.uuid().nullable().optional(),
})
export type AcceptTransfer = z.infer<typeof AcceptTransferSchema>
const TransferReasonSchema = z.string().trim().min(3).max(1000)

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

export async function approveTransfer(
  database: PrismaClient,
  actorId: string,
  sendingSchoolId: string,
  transferId: string,
) {
  await requireTransferSchoolRole(database, actorId, sendingSchoolId)
  return database.$transaction(async (transaction) => {
    const transfer = await transaction.transferRequest.findFirst({
      where: { id: transferId, sendingSchoolId, status: 'requested' },
      include: { sourceEnrollment: { select: { status: true } } },
    })
    if (!transfer || transfer.sourceEnrollment.status !== 'approved')
      throw new TransferStateError()
    const changed = await transaction.transferRequest.updateMany({
      where: { id: transferId, sendingSchoolId, status: 'requested' },
      data: {
        status: 'approvedBySendingSchool',
        sendingApprovedById: actorId,
        sendingApprovedAt: new Date(),
      },
    })
    if (changed.count !== 1) throw new TransferStateError()
    return transaction.transferRequest.findUniqueOrThrow({
      where: { id: transferId },
    })
  })
}

export async function acceptTransfer(
  database: PrismaClient,
  actorId: string,
  receivingSchoolId: string,
  transferId: string,
  input: AcceptTransfer,
) {
  const destination = AcceptTransferSchema.parse(input)
  await requireTransferSchoolRole(database, actorId, receivingSchoolId)
  try {
    return await database.$transaction(async (transaction) => {
      const transfer = await transaction.transferRequest.findFirst({
        where: {
          id: transferId,
          receivingSchoolId,
          status: 'approvedBySendingSchool',
        },
        include: { sourceEnrollment: { select: { status: true } } },
      })
      if (!transfer || transfer.sourceEnrollment.status !== 'approved')
        throw new TransferStateError()
      const [year, grade, schoolClass] = await Promise.all([
        transaction.academicYear.findFirst({
          where: {
            id: destination.academicYearId,
            schoolId: receivingSchoolId,
          },
        }),
        transaction.gradeLevel.findFirst({
          where: { id: destination.gradeLevelId, schoolId: receivingSchoolId },
        }),
        destination.schoolClassId
          ? transaction.schoolClass.findFirst({
              where: {
                id: destination.schoolClassId,
                schoolId: receivingSchoolId,
                academicYearId: destination.academicYearId,
                gradeLevelId: destination.gradeLevelId,
              },
            })
          : Promise.resolve(null),
      ])
      if (!year || !grade || (destination.schoolClassId && !schoolClass))
        throw new TransferDestinationError()
      const receivingEnrollment = await transaction.enrollment.create({
        data: {
          studentId: transfer.studentId,
          schoolId: receivingSchoolId,
          academicYearId: destination.academicYearId,
          gradeLevelId: destination.gradeLevelId,
          schoolClassId: destination.schoolClassId ?? null,
          status: 'pending',
        },
      })
      const sourceChanged = await transaction.enrollment.updateMany({
        where: { id: transfer.sourceEnrollmentId, status: 'approved' },
        data: {
          status: 'withdrawn',
          withdrawnAt: new Date(),
          withdrawnById: actorId,
          withdrawalReason: 'transfer',
        },
      })
      if (sourceChanged.count !== 1) throw new TransferStateError()
      const now = new Date()
      const changed = await transaction.transferRequest.updateMany({
        where: { id: transferId, status: 'approvedBySendingSchool' },
        data: {
          status: 'acceptedByReceivingSchool',
          receivingEnrollmentId: receivingEnrollment.id,
          acceptedById: actorId,
          acceptedAt: now,
          completedAt: now,
        },
      })
      if (changed.count !== 1) throw new TransferStateError()
      return transaction.transferRequest.findUniqueOrThrow({
        where: { id: transferId },
      })
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003'].includes(error.code)
    )
      throw new TransferDestinationError()
    throw error
  }
}

export async function rejectTransfer(
  database: PrismaClient,
  actorId: string,
  receivingSchoolId: string,
  transferId: string,
  reason: string,
) {
  const rejectionReason = TransferReasonSchema.parse(reason)
  await requireTransferSchoolRole(database, actorId, receivingSchoolId)
  const changed = await database.transferRequest.updateMany({
    where: {
      id: transferId,
      receivingSchoolId,
      status: 'approvedBySendingSchool',
    },
    data: {
      status: 'rejected',
      rejectionReason,
      rejectedById: actorId,
      rejectedAt: new Date(),
    },
  })
  if (changed.count !== 1) throw new TransferStateError()
  return database.transferRequest.findUniqueOrThrow({
    where: { id: transferId },
  })
}

export async function cancelTransfer(
  database: PrismaClient,
  actorId: string,
  sendingSchoolId: string,
  transferId: string,
  reason: string,
) {
  const cancellationReason = TransferReasonSchema.parse(reason)
  await requireTransferSchoolRole(database, actorId, sendingSchoolId)
  const changed = await database.transferRequest.updateMany({
    where: {
      id: transferId,
      sendingSchoolId,
      status: { in: ['requested', 'approvedBySendingSchool'] },
    },
    data: {
      status: 'cancelled',
      cancellationReason,
      cancelledById: actorId,
      cancelledAt: new Date(),
    },
  })
  if (changed.count !== 1) throw new TransferStateError()
  return database.transferRequest.findUniqueOrThrow({
    where: { id: transferId },
  })
}

export type { TransferRequest, TransferStatus } from '@prisma/client'
