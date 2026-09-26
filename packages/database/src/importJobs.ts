import type { ImportIssueSeverity, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'

export class ImportPermissionError extends Error {
  constructor() {
    super('Import permission denied')
  }
}

export class ImportStateError extends Error {
  constructor(message = 'Import job cannot change in its current state') {
    super(message)
  }
}

export const CreateImportJobSchema = z.strictObject({
  schoolId: z.uuid(),
  originalFileName: z.string().trim().min(1).max(255).optional(),
})

export const ImportIssueSchema = z.strictObject({
  rowNumber: z.number().int().positive(),
  severity: z.enum(['error', 'warning']),
  code: z.string().regex(/^[a-z][a-zA-Z0-9]{1,59}$/),
  message: z.string().min(1).max(160),
})

const ImportValidationSchema = z
  .strictObject({
    totalRows: z.number().int().min(0).max(500),
    validRows: z.number().int().min(0).max(500),
    invalidRows: z.number().int().min(0).max(500),
    issues: z.array(ImportIssueSchema).max(1000),
  })
  .refine(
    (value) => value.validRows + value.invalidRows === value.totalRows,
    'Import row counts must agree',
  )

export async function requireSchoolImportPermission(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new ImportPermissionError()
  if (
    await hasOrganizationAdminRole(database, actorUserId, school.organizationId)
  )
    return
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorUserId, schoolId } },
  })
  if (!membership || !['administrator', 'registrar'].includes(membership.role))
    throw new ImportPermissionError()
}

export async function createImportJob(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  const data = CreateImportJobSchema.parse(input)
  await requireSchoolImportPermission(database, actorUserId, data.schoolId)
  return database.importJob.create({
    data: {
      schoolId: data.schoolId,
      createdById: actorUserId,
      type: 'studentRegistration',
      ...(data.originalFileName
        ? { originalFileName: data.originalFileName }
        : {}),
    },
  })
}

export async function listSchoolImportJobs(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
) {
  await requireSchoolImportPermission(database, actorUserId, schoolId)
  return database.importJob.findMany({
    where: { schoolId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  })
}

export async function getImportJob(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  jobId: string,
) {
  await requireSchoolImportPermission(database, actorUserId, schoolId)
  z.uuid().parse(jobId)
  const job = await database.importJob.findFirst({
    where: { id: jobId, schoolId },
    include: { issues: { orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }] } },
  })
  if (!job) throw new ImportPermissionError()
  return job
}

export async function recordImportValidation(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  jobId: string,
  input: unknown,
) {
  const result = ImportValidationSchema.parse(input)
  await getImportJob(database, actorUserId, schoolId, jobId)
  return database.$transaction(async (transaction) => {
    const updated = await transaction.importJob.updateMany({
      where: {
        id: jobId,
        schoolId,
        status: { in: ['uploaded', 'validated', 'invalid'] },
      },
      data: {
        status: result.invalidRows > 0 ? 'invalid' : 'validated',
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        validatedAt: new Date(),
      },
    })
    if (updated.count !== 1) throw new ImportStateError()
    await transaction.importRowIssue.deleteMany({ where: { jobId } })
    if (result.issues.length)
      await transaction.importRowIssue.createMany({
        data: result.issues.map((issue) => ({
          jobId,
          rowNumber: issue.rowNumber,
          severity: issue.severity as ImportIssueSeverity,
          code: issue.code,
          message: issue.message,
        })),
      })
    return transaction.importJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { issues: true },
    })
  })
}

export async function cancelImportJob(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  jobId: string,
) {
  await getImportJob(database, actorUserId, schoolId, jobId)
  const updated = await database.importJob.updateMany({
    where: {
      id: jobId,
      schoolId,
      status: { in: ['uploaded', 'validated', 'invalid'] },
    },
    data: { status: 'cancelled' },
  })
  if (updated.count !== 1) throw new ImportStateError()
  return database.importJob.findUniqueOrThrow({ where: { id: jobId } })
}
