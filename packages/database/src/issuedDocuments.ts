import { randomBytes } from 'node:crypto'
import { type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolMembership } from './schoolMemberships.js'

export const IssueDocumentSchema = z.strictObject({
  schoolId: z.uuid(),
  studentId: z.uuid(),
  academicYearId: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
})

export type IssueDocument = z.infer<typeof IssueDocumentSchema>

export class DocumentPermissionError extends Error {
  constructor() {
    super('Document authority required')
  }
}

export class DocumentSourceError extends Error {
  constructor() {
    super('Official published results are required')
  }
}

export async function requireDocumentAuthority(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new DocumentPermissionError()
  const membership = await findSchoolMembership(database, actorId, schoolId)
  if (
    membership?.role !== 'administrator' &&
    membership?.role !== 'approver' &&
    !(await hasOrganizationAdminRole(database, actorId, school.organizationId))
  )
    throw new DocumentPermissionError()
}

export function generateVerificationReference() {
  return 'WRK-' + randomBytes(16).toString('hex').toUpperCase()
}

export async function issueDocument(
  database: PrismaClient,
  actorId: string,
  input: IssueDocument,
) {
  const data = IssueDocumentSchema.parse(input)
  z.uuid().parse(actorId)
  await requireDocumentAuthority(database, actorId, data.schoolId)
  const official = await database.publishedResult.findFirst({
    where: {
      studentId: data.studentId,
      schoolId: data.schoolId,
      resultSet: {
        academicYearId: data.academicYearId,
        status: 'published',
      },
      enrollment: {
        status: { in: ['approved', 'withdrawn'] },
      },
    },
    select: { id: true },
  })
  if (!official) throw new DocumentSourceError()
  return database.issuedDocument.create({
    data: {
      ...data,
      issuedById: actorId,
      verificationReference: generateVerificationReference(),
    },
  })
}

export async function findIssuedDocument(
  database: PrismaClient,
  schoolId: string,
  id: string,
) {
  return database.issuedDocument.findFirst({ where: { id, schoolId } })
}

export async function findDocumentByReference(
  database: PrismaClient,
  reference: string,
) {
  return database.issuedDocument.findUnique({
    where: { verificationReference: reference },
  })
}

export async function listStudentDocuments(
  database: PrismaClient,
  schoolId: string,
  studentId: string,
) {
  return database.issuedDocument.findMany({
    where: { schoolId, studentId },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
  })
}

export async function listSchoolDocuments(
  database: PrismaClient,
  schoolId: string,
) {
  return database.issuedDocument.findMany({
    where: { schoolId },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
  })
}

export type {
  DocumentType,
  DocumentStatus,
  IssuedDocument,
} from '@prisma/client'
