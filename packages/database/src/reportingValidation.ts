import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { reportingWindowState } from './reportingPeriods.js'

const count = z.number().int().nonnegative()
const reportedEnrollment = z.strictObject({
  dataState: z.literal('reported'),
  total: count,
  byAcademicYear: z.array(
    z.strictObject({ academicYearId: z.uuid(), name: z.string(), count }),
  ),
  byGradeLevel: z.array(
    z.strictObject({ gradeLevelId: z.uuid(), name: z.string(), count }),
  ),
})
const reportedAcademic = z.strictObject({
  dataState: z.literal('reported'),
  publishedResultCount: count,
  outcomes: z.array(z.strictObject({ gradeLabel: z.string().min(1), count })),
})
const unavailable = z.strictObject({
  dataState: z.enum(['unknown', 'notReported', 'notApplicable']),
})
export const ReportingSnapshotSchema = z.strictObject({
  enrollment: z.union([reportedEnrollment, unavailable]),
  academic: z.union([reportedAcademic, unavailable]),
  activity: z.strictObject({
    transfers: z.strictObject({
      confirmed: count,
      unresolved: count,
      rejected: count,
    }),
    verification: z.strictObject({
      active: count,
      corrected: count,
      withdrawn: count,
      unavailable: count,
    }),
  }),
})

export function validateReportingSnapshot(snapshot: unknown) {
  const parsed = ReportingSnapshotSchema.safeParse(snapshot)
  const blocking: string[] = []
  const warnings: string[] = []
  if (!parsed.success)
    return {
      ready: false,
      warnings,
      blocking: ['REPORTING_REQUIRED_FIELDS_MISSING'],
    }
  const value = parsed.data
  if (value.enrollment.dataState !== 'reported')
    blocking.push('REPORTING_ENROLLMENT_NOT_REPORTED')
  else {
    if (
      value.enrollment.byAcademicYear.reduce(
        (sum, item) => sum + item.count,
        0,
      ) !== value.enrollment.total
    )
      blocking.push('REPORTING_ENROLLMENT_YEAR_TOTAL_MISMATCH')
    if (
      value.enrollment.byGradeLevel.reduce(
        (sum, item) => sum + item.count,
        0,
      ) !== value.enrollment.total
    )
      blocking.push('REPORTING_ENROLLMENT_GRADE_TOTAL_MISMATCH')
  }
  if (value.academic.dataState !== 'reported')
    blocking.push('REPORTING_ACADEMIC_NOT_REPORTED')
  else if (
    value.academic.outcomes.reduce((sum, item) => sum + item.count, 0) !==
    value.academic.publishedResultCount
  )
    blocking.push('REPORTING_ACADEMIC_TOTAL_MISMATCH')
  if (value.activity.transfers.unresolved > 0)
    warnings.push('REPORTING_TRANSFERS_UNRESOLVED')
  return { ready: blocking.length === 0, warnings, blocking }
}

export async function evaluateReportingReadiness(
  database: PrismaClient,
  reportingPeriodId: string,
  schoolId: string,
  now = new Date(),
) {
  z.uuid().parse(reportingPeriodId)
  z.uuid().parse(schoolId)
  const [requirement, submission, blockers] = await Promise.all([
    database.reportingRequirement.findUnique({
      where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
      include: { reportingPeriod: true },
    }),
    database.reportingSubmission.findUnique({
      where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
    }),
    database.dataQualityIssue.findMany({
      where: { schoolId, status: 'open', severity: 'blocking' },
      select: { code: true },
    }),
  ])
  const blocking: string[] = []
  const warnings: string[] = []
  if (!requirement || requirement.reportingPeriod.status !== 'open')
    blocking.push('REPORTING_SCHOOL_OR_PERIOD_NOT_ELIGIBLE')
  if (requirement) {
    const window = reportingWindowState(requirement.reportingPeriod, now)
    if (window === 'notOpen' || window === 'closed')
      blocking.push('REPORTING_WINDOW_CLOSED')
    if (window === 'pastDue') warnings.push('REPORTING_DUE_TIME_PASSED')
  }
  const snapshot = validateReportingSnapshot(submission?.snapshot)
  blocking.push(
    ...snapshot.blocking,
    ...blockers.map((issue) => `QUALITY:${issue.code}`),
  )
  warnings.push(...snapshot.warnings)
  return { ready: blocking.length === 0, warnings, blocking }
}
