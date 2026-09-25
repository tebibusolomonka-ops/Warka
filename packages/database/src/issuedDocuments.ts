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

export const DocumentReasonSchema = z.string().trim().min(3).max(1000)

export class DocumentStateError extends Error {
  constructor() {
    super('Document is not active')
  }
}

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
  return database.$transaction((transaction) =>
    createDocumentInTransaction(transaction, actorId, data),
  )
}

async function createDocumentInTransaction(
  transaction: Prisma.TransactionClient,
  actorId: string,
  data: IssueDocument,
  supersedesId?: string,
) {
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
      ...(supersedesId ? { supersedesId } : {}),
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  })
}

export async function correctDocument(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  documentId: string,
  reason: string,
) {
  z.uuid().parse(documentId)
  const correctionReason = DocumentReasonSchema.parse(reason)
  await requireDocumentAuthority(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const previous = await transaction.issuedDocument.findFirst({
      where: { id: documentId, schoolId },
    })
    if (!previous || previous.status !== 'active')
      throw new DocumentStateError()
    const changed = await transaction.issuedDocument.updateMany({
      where: { id: previous.id, status: 'active' },
      data: {
        status: 'corrected',
        correctionReason,
        correctedById: actorId,
        correctedAt: new Date(),
      },
    })
    if (changed.count !== 1) throw new DocumentStateError()
    return createDocumentInTransaction(
      transaction,
      actorId,
      {
        schoolId,
        studentId: previous.studentId,
        academicYearId: previous.academicYearId,
        documentType: previous.documentType,
      },
      previous.id,
    )
  })
}

export async function withdrawDocument(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  documentId: string,
  reason: string,
) {
  z.uuid().parse(documentId)
  const withdrawalReason = DocumentReasonSchema.parse(reason)
  await requireDocumentAuthority(database, actorId, schoolId)
  const changed = await database.issuedDocument.updateMany({
    where: { id: documentId, schoolId, status: 'active' },
    data: {
      status: 'withdrawn',
      withdrawalReason,
      withdrawnById: actorId,
      withdrawnAt: new Date(),
    },
  })
  if (changed.count !== 1) throw new DocumentStateError()
  return database.issuedDocument.findUniqueOrThrow({
    where: { id: documentId },
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
