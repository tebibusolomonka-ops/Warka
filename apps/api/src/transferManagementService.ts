import {
  acceptTransfer,
  approveTransfer,
  cancelTransfer,
  rejectTransfer,
  requestTransfer,
  requireTransferSchoolRole,
  TransferPackageSchema,
  type AcceptTransfer,
  type PrismaClient,
} from '@warka/database'
import type { TransferOptions, TransferView } from '@warka/shared'

export class TransferNotFoundError extends Error {
  constructor() {
    super('Transfer not found')
  }
}

const transferInclude = {
  sendingSchool: { select: { name: true } },
  receivingSchool: { select: { name: true } },
  sourceEnrollment: { select: { status: true } },
  receivingEnrollment: {
    include: {
      academicYear: { select: { name: true } },
      gradeLevel: { select: { name: true } },
      schoolClass: { select: { name: true } },
    },
  },
} as const

function view(row: {
  id: string
  status: TransferView['status']
  transferPackage: unknown
  sendingSchool: { name: string }
  receivingSchool: { name: string }
  sourceEnrollment: { status: TransferView['sourceEnrollment']['status'] }
  receivingEnrollment: null | {
    status: TransferView['sourceEnrollment']['status']
    academicYear: { name: string }
    gradeLevel: { name: string }
    schoolClass: { name: string } | null
  }
  requestedAt: Date
  sendingApprovedAt: Date | null
  completedAt: Date | null
  rejectionReason: string | null
  cancellationReason: string | null
}): TransferView {
  const transferPackage = TransferPackageSchema.parse(row.transferPackage)
  return {
    id: row.id,
    status: row.status,
    student: transferPackage.student,
    sendingSchool: row.sendingSchool.name,
    receivingSchool: row.receivingSchool.name,
    sourceEnrollment: {
      status: row.sourceEnrollment.status,
      academicYear: transferPackage.sourceAcademicYear,
      gradeLevel: transferPackage.sourceGradeLevel,
      schoolClass: transferPackage.sourceClass,
    },
    receivingEnrollment: row.receivingEnrollment
      ? {
          status: row.receivingEnrollment.status,
          academicYear: row.receivingEnrollment.academicYear.name,
          gradeLevel: row.receivingEnrollment.gradeLevel.name,
          schoolClass: row.receivingEnrollment.schoolClass?.name ?? null,
        }
      : null,
    requestedAt: row.requestedAt.toISOString(),
    sendingApprovedAt: row.sendingApprovedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    cancellationReason: row.cancellationReason,
  }
}

export type TransferManagementService = {
  options(actorId: string, schoolId: string): Promise<TransferOptions>
  list(
    actorId: string,
    schoolId: string,
    direction: 'outgoing' | 'incoming',
  ): Promise<TransferView[]>
  detail(
    actorId: string,
    schoolId: string,
    transferId: string,
  ): Promise<TransferView>
  request(
    actorId: string,
    schoolId: string,
    studentId: string,
    sourceEnrollmentId: string,
    receivingSchoolId: string,
  ): Promise<TransferView>
  approve(
    actorId: string,
    schoolId: string,
    transferId: string,
  ): Promise<TransferView>
  accept(
    actorId: string,
    schoolId: string,
    transferId: string,
    input: AcceptTransfer,
  ): Promise<TransferView>
  reject(
    actorId: string,
    schoolId: string,
    transferId: string,
    reason: string,
  ): Promise<TransferView>
  cancel(
    actorId: string,
    schoolId: string,
    transferId: string,
    reason: string,
  ): Promise<TransferView>
}

export function prismaTransferManagementService(
  database: PrismaClient,
): TransferManagementService {
  async function detail(actorId: string, schoolId: string, transferId: string) {
    await requireTransferSchoolRole(database, actorId, schoolId)
    const row = await database.transferRequest.findFirst({
      where: {
        id: transferId,
        OR: [{ sendingSchoolId: schoolId }, { receivingSchoolId: schoolId }],
      },
      include: transferInclude,
    })
    if (!row) throw new TransferNotFoundError()
    return view(row)
  }
  return {
    async options(actorId, schoolId) {
      await requireTransferSchoolRole(database, actorId, schoolId)
      const school = await database.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: { organizationId: true },
      })
      const [
        enrollments,
        receivingSchools,
        academicYears,
        gradeLevels,
        classes,
      ] = await Promise.all([
        database.enrollment.findMany({
          where: { schoolId, status: 'approved' },
          include: {
            student: true,
            academicYear: { select: { name: true } },
            gradeLevel: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        database.school.findMany({
          where: {
            organizationId: school.organizationId,
            id: { not: schoolId },
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        database.academicYear.findMany({
          where: { schoolId },
          select: { id: true, name: true },
          orderBy: { startsOn: 'desc' },
        }),
        database.gradeLevel.findMany({
          where: { schoolId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        database.schoolClass.findMany({
          where: { schoolId },
          select: {
            id: true,
            name: true,
            academicYearId: true,
            gradeLevelId: true,
          },
          orderBy: { name: 'asc' },
        }),
      ])
      return {
        eligibleStudents: enrollments.map((enrollment) => ({
          studentId: enrollment.studentId,
          studentReference: enrollment.student.studentReference,
          displayName: [
            enrollment.student.givenName,
            enrollment.student.familyName,
          ]
            .filter(Boolean)
            .join(' '),
          sourceEnrollmentId: enrollment.id,
          academicYear: enrollment.academicYear.name,
          gradeLevel: enrollment.gradeLevel.name,
        })),
        receivingSchools,
        academicYears,
        gradeLevels,
        classes,
      }
    },
    async list(actorId, schoolId, direction) {
      await requireTransferSchoolRole(database, actorId, schoolId)
      const rows = await database.transferRequest.findMany({
        where:
          direction === 'outgoing'
            ? { sendingSchoolId: schoolId }
            : { receivingSchoolId: schoolId },
        include: transferInclude,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map(view)
    },
    detail,
    async request(
      actorId,
      schoolId,
      studentId,
      sourceEnrollmentId,
      receivingSchoolId,
    ) {
      await requireTransferSchoolRole(database, actorId, schoolId)
      const sourceSchool = await database.school.findUnique({
        where: { id: schoolId },
        select: { organizationId: true },
      })
      const receivingSchool = await database.school.findUnique({
        where: { id: receivingSchoolId },
        select: { organizationId: true },
      })
      if (
        !sourceSchool ||
        !receivingSchool ||
        sourceSchool.organizationId !== receivingSchool.organizationId
      )
        throw new TransferNotFoundError()
      const transfer = await requestTransfer(database, actorId, {
        studentId,
        sendingSchoolId: schoolId,
        receivingSchoolId,
        sourceEnrollmentId,
      })
      return detail(actorId, schoolId, transfer.id)
    },
    async approve(actorId, schoolId, transferId) {
      await approveTransfer(database, actorId, schoolId, transferId)
      return detail(actorId, schoolId, transferId)
    },
    async accept(actorId, schoolId, transferId, input) {
      await acceptTransfer(database, actorId, schoolId, transferId, input)
      return detail(actorId, schoolId, transferId)
    },
    async reject(actorId, schoolId, transferId, reason) {
      await rejectTransfer(database, actorId, schoolId, transferId, reason)
      return detail(actorId, schoolId, transferId)
    },
    async cancel(actorId, schoolId, transferId, reason) {
      await cancelTransfer(database, actorId, schoolId, transferId, reason)
      return detail(actorId, schoolId, transferId)
    },
  }
}
