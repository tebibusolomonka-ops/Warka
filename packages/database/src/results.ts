import { Prisma, type PrismaClient, type ResultSet } from '@prisma/client'
import { z } from 'zod'
import { listAssessments } from './assessments.js'
import {
  calculateResult,
  getGradingScheme,
  orderedGradeBands,
} from './grading.js'
import { findGradingPeriodById } from './gradingPeriods.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { findSchoolClassById } from './schoolClasses.js'
import { findSchoolMembership } from './schoolMemberships.js'
import { findSubjectById } from './subjects.js'
import { mayManageClassSubject } from './teachingAssignments.js'

export const ResultContextSchema = z.object({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  gradingPeriodId: z.uuid(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
})
export type ResultContext = z.input<typeof ResultContextSchema>

export class InvalidResultContextError extends Error {
  constructor() {
    super('Result context is invalid for this school and academic year')
  }
}
export class ResultPermissionError extends Error {
  constructor() {
    super('User is not authorized for this result workflow')
  }
}
export class ResultStateError extends Error {
  constructor() {
    super('Result set is not in the required lifecycle state')
  }
}
export class IncompleteResultsError extends Error {
  constructor() {
    super('Assessment configuration or required student marks are incomplete')
  }
}

async function schoolAccess(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new InvalidResultContextError()
  const organizationAdmin = await hasOrganizationAdminRole(
    database,
    actorId,
    school.organizationId,
  )
  const membership = await findSchoolMembership(database, actorId, schoolId)
  return { organizationAdmin, role: membership?.role }
}

async function canViewContext(
  database: PrismaClient,
  actorId: string,
  context: ResultContext,
) {
  const access = await schoolAccess(database, actorId, context.schoolId)
  if (
    access.organizationAdmin ||
    access.role === 'administrator' ||
    access.role === 'approver'
  )
    return true
  if (access.role !== 'teacher') return false
  return mayManageClassSubject(
    database,
    actorId,
    context.schoolId,
    context.academicYearId,
    context.schoolClassId,
    context.subjectId,
  )
}

async function requirePublisher(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const access = await schoolAccess(database, actorId, schoolId)
  if (
    !access.organizationAdmin &&
    access.role !== 'administrator' &&
    access.role !== 'approver'
  ) {
    throw new ResultPermissionError()
  }
}

function whereContext(context: ResultContext) {
  return {
    schoolId: context.schoolId,
    academicYearId: context.academicYearId,
    gradingPeriodId: context.gradingPeriodId,
    schoolClassId: context.schoolClassId,
    subjectId: context.subjectId,
  }
}

export async function previewResults(
  database: PrismaClient,
  actorId: string,
  input: ResultContext,
) {
  const context = ResultContextSchema.parse(input)
  z.uuid().parse(actorId)
  if (!(await canViewContext(database, actorId, context)))
    throw new ResultPermissionError()
  const [period, schoolClass, subject] = await Promise.all([
    findGradingPeriodById(
      database,
      context.schoolId,
      context.academicYearId,
      context.gradingPeriodId,
    ),
    findSchoolClassById(database, context.schoolId, context.schoolClassId),
    findSubjectById(database, context.schoolId, context.subjectId),
  ])
  if (
    !period ||
    !schoolClass ||
    schoolClass.academicYearId !== context.academicYearId ||
    !subject
  ) {
    throw new InvalidResultContextError()
  }
  const [assessments, scheme, resultSet] = await Promise.all([
    listAssessments(
      database,
      context.schoolId,
      context.academicYearId,
      context.gradingPeriodId,
      context.schoolClassId,
      context.subjectId,
    ),
    getGradingScheme(database, context.schoolId),
    database.resultSet.findUnique({
      where: {
        schoolId_academicYearId_gradingPeriodId_schoolClassId_subjectId:
          whereContext(context),
      },
      include: { results: true },
    }),
  ])
  const enrollments = await database.enrollment.findMany({
    where: {
      schoolId: context.schoolId,
      academicYearId: context.academicYearId,
      schoolClassId: context.schoolClassId,
      ...(resultSet?.status === 'published'
        ? { id: { in: resultSet.results.map((item) => item.enrollmentId) } }
        : { status: 'approved' as const }),
    },
    include: {
      student: {
        select: { studentReference: true, givenName: true, familyName: true },
      },
    },
    orderBy: [{ student: { studentReference: 'asc' } }],
  })
  const marks =
    assessments.length && enrollments.length
      ? await database.mark.findMany({
          where: {
            schoolId: context.schoolId,
            assessmentId: { in: assessments.map((item) => item.id) },
            enrollmentId: { in: enrollments.map((item) => item.id) },
          },
        })
      : []
  const rows = enrollments.map((enrollment) => {
    const published =
      resultSet?.results.find((item) => item.enrollmentId === enrollment.id) ??
      null
    const calculation =
      resultSet?.status === 'published'
        ? published
          ? {
              status: 'ready' as const,
              percentage: published.currentPercentage.toFixed(2),
              gradeLabel: published.currentGradeLabel,
              missingAssessmentIds: [],
              configurationProblems: [],
            }
          : {
              status: 'incomplete_configuration' as const,
              percentage: null,
              gradeLabel: null,
              missingAssessmentIds: [],
              configurationProblems: ['PUBLISHED_SNAPSHOT_MISSING'],
            }
        : calculateResult(
            assessments,
            marks.filter((mark) => mark.enrollmentId === enrollment.id),
            scheme?.bands ?? [],
          )
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      studentReference: enrollment.student.studentReference,
      givenName: enrollment.student.givenName,
      familyName: enrollment.student.familyName,
      marks: marks
        .filter((mark) => mark.enrollmentId === enrollment.id)
        .map((mark) => ({
          id: mark.id,
          assessmentId: mark.assessmentId,
          score: mark.score.toFixed(2),
        })),
      calculation,
      published,
    }
  })
  return {
    context,
    assessments: assessments.map((item) => ({
      id: item.id,
      name: item.name,
      maximumScore: item.maximumScore.toFixed(2),
      weight: item.weight.toFixed(2),
      position: item.position,
    })),
    gradingSchemeReady: Boolean(scheme),
    status: resultSet?.status ?? 'draft',
    resultSetId: resultSet?.id ?? null,
    submittedAt: resultSet?.submittedAt ?? null,
    submittedById: resultSet?.submittedById ?? null,
    publishedAt: resultSet?.publishedAt ?? null,
    rows,
    complete:
      rows.length > 0 &&
      rows.every((row) => row.calculation.status === 'ready'),
  }
}

export async function submitResults(
  database: PrismaClient,
  actorId: string,
  input: ResultContext,
): Promise<ResultSet> {
  const context = ResultContextSchema.parse(input)
  const access = await schoolAccess(database, actorId, context.schoolId)
  if (
    access.role !== 'teacher' ||
    !(await mayManageClassSubject(
      database,
      actorId,
      context.schoolId,
      context.academicYearId,
      context.schoolClassId,
      context.subjectId,
    ))
  ) {
    throw new ResultPermissionError()
  }
  return database.$transaction(
    async (transaction) => {
      const tx = transaction as PrismaClient
      const preview = await previewResults(tx, actorId, context)
      if (preview.status !== 'draft') throw new ResultStateError()
      if (!preview.complete) throw new IncompleteResultsError()
      const current = await transaction.resultSet.findUnique({
        where: {
          schoolId_academicYearId_gradingPeriodId_schoolClassId_subjectId:
            whereContext(context),
        },
      })
      if (current) {
        return transaction.resultSet.update({
          where: { id: current.id },
          data: {
            status: 'pending',
            submittedAt: new Date(),
            submittedById: actorId,
          },
        })
      }
      return transaction.resultSet.create({
        data: {
          ...context,
          status: 'pending',
          submittedAt: new Date(),
          submittedById: actorId,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function publishResults(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  resultSetId: string,
) {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  z.uuid().parse(resultSetId)
  await requirePublisher(database, actorId, schoolId)
  return database.$transaction(
    async (transaction) => {
      const resultSet = await transaction.resultSet.findFirst({
        where: { id: resultSetId, schoolId },
      })
      if (!resultSet) throw new InvalidResultContextError()
      if (resultSet.status !== 'pending') throw new ResultStateError()
      if (resultSet.submittedById === actorId) throw new ResultPermissionError()
      const preview = await previewResults(
        transaction as PrismaClient,
        actorId,
        resultSet,
      )
      if (!preview.complete) throw new IncompleteResultsError()
      await transaction.publishedResult.createMany({
        data: preview.rows.map((row) => ({
          schoolId,
          resultSetId,
          studentId: row.studentId,
          enrollmentId: row.enrollmentId,
          percentage: new Prisma.Decimal(row.calculation.percentage!),
          gradeLabel: row.calculation.gradeLabel!,
          currentPercentage: new Prisma.Decimal(row.calculation.percentage!),
          currentGradeLabel: row.calculation.gradeLabel!,
        })),
      })
      return transaction.resultSet.update({
        where: { id: resultSetId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          publishedById: actorId,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function correctPublishedResult(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  publishedResultId: string,
  newPercentage: string,
  reason: string,
) {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  z.uuid().parse(publishedResultId)
  const percentage = z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/)
    .parse(newPercentage)
  const checkedReason = z.string().trim().min(5).max(500).parse(reason)
  const decimal = new Prisma.Decimal(percentage)
  if (decimal.gt(100)) throw new IncompleteResultsError()
  await requirePublisher(database, actorId, schoolId)
  return database.$transaction(
    async (transaction) => {
      const result = await transaction.publishedResult.findFirst({
        where: {
          id: publishedResultId,
          schoolId,
          resultSet: { status: 'published' },
        },
      })
      if (!result) throw new InvalidResultContextError()
      const scheme = await getGradingScheme(
        transaction as PrismaClient,
        schoolId,
      )
      if (!scheme) throw new IncompleteResultsError()
      const band = orderedGradeBands(scheme.bands).find((item) =>
        decimal.gte(item.minimumPercentage),
      )
      if (!band) throw new IncompleteResultsError()
      const correction = await transaction.resultCorrection.create({
        data: {
          schoolId,
          publishedResultId,
          previousPercentage: result.currentPercentage,
          previousGradeLabel: result.currentGradeLabel,
          newPercentage: decimal,
          newGradeLabel: band.label,
          reason: checkedReason,
          actorId,
        },
      })
      await transaction.publishedResult.update({
        where: { id: result.id },
        data: { currentPercentage: decimal, currentGradeLabel: band.label },
      })
      return correction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function listPendingResultSets(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requirePublisher(database, actorId, schoolId)
  return database.resultSet.findMany({
    where: { schoolId, status: 'pending' },
    include: {
      academicYear: true,
      gradingPeriod: true,
      schoolClass: true,
      subject: true,
      submittedBy: { select: { displayName: true } },
    },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
  })
}

export async function listPublishedResultSets(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requirePublisher(database, actorId, schoolId)
  return database.resultSet.findMany({
    where: { schoolId, status: 'published' },
    include: {
      academicYear: true,
      gradingPeriod: true,
      schoolClass: true,
      subject: true,
      submittedBy: { select: { displayName: true } },
    },
    orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
  })
}

export async function listResultCorrections(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  publishedResultId: string,
) {
  await requirePublisher(database, actorId, schoolId)
  return database.resultCorrection.findMany({
    where: { schoolId, publishedResultId },
    orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
  })
}

export async function assertResultSetDraft(
  database: PrismaClient,
  context: ResultContext,
): Promise<void> {
  const current = await database.resultSet.findFirst({
    where: {
      ...whereContext(context),
      status: { in: ['pending', 'published'] },
    },
    select: { id: true },
  })
  if (current) throw new ResultStateError()
}
