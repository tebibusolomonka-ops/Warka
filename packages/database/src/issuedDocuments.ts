import { randomBytes } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
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

export const DocumentSnapshotSchema = z.strictObject({
  student: z.strictObject({
    displayName: z.string().min(1),
    studentReference: z.string().min(1),
  }),
  issuingSchool: z.string().min(1),
  documentType: z.enum(['reportCard', 'transcript']),
  issuedAt: z.iso.datetime(),
  academicYear: z.string().min(1),
  subjects: z
    .array(
      z.strictObject({
        subject: z.string().min(1),
        gradingPeriod: z.string().min(1),
        percentage: z.number().min(0).max(100),
        gradeLabel: z.string().min(1),
      }),
    )
    .min(1),
})

export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>

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
  return database.$transaction(async (transaction) => {
    const [student, school, year, official] = await Promise.all([
      transaction.student.findUnique({ where: { id: data.studentId } }),
      transaction.school.findUnique({ where: { id: data.schoolId } }),
      transaction.academicYear.findFirst({
        where: { id: data.academicYearId, schoolId: data.schoolId },
      }),
      transaction.publishedResult.findMany({
        where: {
          studentId: data.studentId,
          schoolId: data.schoolId,
          resultSet: {
            academicYearId: data.academicYearId,
            status: 'published',
            publishedAt: { not: null },
          },
          enrollment: { status: { in: ['approved', 'withdrawn'] } },
        },
        include: {
          resultSet: {
            include: { subject: true, gradingPeriod: true },
          },
        },
        orderBy: [
          { resultSet: { gradingPeriod: { startsOn: 'asc' } } },
          { resultSet: { subject: { name: 'asc' } } },
        ],
      }),
    ])
    if (!student || !school || !year || official.length === 0)
      throw new DocumentSourceError()
    const issuedAt = new Date()
    const snapshot = DocumentSnapshotSchema.parse({
      student: {
        displayName: [student.givenName, student.familyName]
          .filter(Boolean)
          .join(' '),
        studentReference: student.studentReference,
      },
      issuingSchool: school.name,
      documentType: data.documentType,
      issuedAt: issuedAt.toISOString(),
      academicYear: year.name,
      subjects: official.map((result) => ({
        subject: result.resultSet.subject.name,
        gradingPeriod: result.resultSet.gradingPeriod.name,
        percentage: result.currentPercentage.toNumber(),
        gradeLabel: result.currentGradeLabel,
      })),
    })
    return transaction.issuedDocument.create({
      data: {
        ...data,
        issuedAt,
        issuedById: actorId,
        verificationReference: generateVerificationReference(),
        snapshot: snapshot as Prisma.InputJsonValue,
      },
    })
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
