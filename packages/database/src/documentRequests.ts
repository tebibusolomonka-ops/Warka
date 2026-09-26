import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'

export class DocumentRequestPermissionError extends Error {
  constructor() {
    super('Document request permission denied')
  }
}
export class DocumentRequestStateError extends Error {
  constructor() {
    super('Document request cannot change in its current state')
  }
}
export const CreateDocumentRequestSchema = z.strictObject({
  schoolId: z.uuid(),
  studentId: z.uuid(),
  academicYearId: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
})
async function staffRole(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) return null
  if (await hasOrganizationAdminRole(database, actorId, school.organizationId))
    return 'administrator'
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId } },
  })
  return membership?.role ?? null
}
export async function requireDocumentRequestStaff(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  const role = await staffRole(database, actorId, schoolId)
  if (!role || !['administrator', 'registrar', 'approver'].includes(role))
    throw new DocumentRequestPermissionError()
  return role
}
export async function createDocumentRequest(
  database: PrismaClient,
  actorId: string,
  input: unknown,
) {
  const data = CreateDocumentRequestSchema.parse(input)
  z.uuid().parse(actorId)
  const access = await database.studentAccess.findUnique({
    where: { userId: actorId },
    select: { studentId: true },
  })
  if (access?.studentId !== data.studentId)
    await requireDocumentRequestStaff(database, actorId, data.schoolId)
  const enrollment = await database.enrollment.findFirst({
    where: {
      schoolId: data.schoolId,
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      status: { in: ['approved', 'withdrawn'] },
    },
    select: { id: true },
  })
  if (!enrollment) throw new DocumentRequestPermissionError()
  return database.documentRequest.create({
    data: { ...data, requestedById: actorId },
  })
}
export async function listStudentDocumentRequests(
  database: PrismaClient,
  actorId: string,
) {
  z.uuid().parse(actorId)
  const access = await database.studentAccess.findUnique({
    where: { userId: actorId },
    select: { studentId: true },
  })
  if (!access) throw new DocumentRequestPermissionError()
  return database.documentRequest.findMany({
    where: { studentId: access.studentId },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: 50,
    include: {
      issuedDocument: { select: { verificationReference: true, status: true } },
    },
  })
}
export async function listSchoolDocumentRequests(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  status?: string,
) {
  await requireDocumentRequestStaff(database, actorId, schoolId)
  const checkedStatus = status
    ? z
        .enum(['requested', 'processing', 'ready', 'rejected', 'cancelled'])
        .parse(status)
    : undefined
  return database.documentRequest.findMany({
    where: { schoolId, ...(checkedStatus ? { status: checkedStatus } : {}) },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: 100,
    include: {
      student: {
        select: { studentReference: true, givenName: true, familyName: true },
      },
      academicYear: { select: { name: true } },
      issuedDocument: { select: { verificationReference: true, status: true } },
    },
  })
}
export async function getDocumentRequest(
  database: PrismaClient,
  actorId: string,
  requestId: string,
) {
  z.uuid().parse(requestId)
  const request = await database.documentRequest.findUnique({
    where: { id: requestId },
    include: {
      student: {
        select: { studentReference: true, givenName: true, familyName: true },
      },
      academicYear: { select: { name: true } },
      issuedDocument: { select: { verificationReference: true, status: true } },
    },
  })
  if (!request) throw new DocumentRequestPermissionError()
  const access = await database.studentAccess.findUnique({
    where: { userId: actorId },
    select: { studentId: true },
  })
  if (access?.studentId !== request.studentId)
    await requireDocumentRequestStaff(database, actorId, request.schoolId)
  return request
}
export async function cancelDocumentRequest(
  database: PrismaClient,
  actorId: string,
  requestId: string,
) {
  const request = await getDocumentRequest(database, actorId, requestId)
  const changed = await database.documentRequest.updateMany({
    where: { id: requestId, status: 'requested' },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })
  if (changed.count !== 1) throw new DocumentRequestStateError()
  return database.documentRequest.findUniqueOrThrow({
    where: { id: request.id },
  })
}
