import type { PrismaClient, ReportingSubmissionStatus } from '@prisma/client'

export type ReportingCoverage = {
  expected: number
  draft: number
  submitted: number
  approved: number
  returned: number
  missing: number
}

export type FreshnessStatus = 'current' | 'due' | 'late' | 'missing'

export function calculateCoverage(
  expected: number,
  statuses: ReportingSubmissionStatus[],
): ReportingCoverage {
  const coverage: ReportingCoverage = {
    expected,
    draft: 0,
    submitted: 0,
    approved: 0,
    returned: 0,
    missing: Math.max(0, expected - statuses.length),
  }
  for (const status of statuses) coverage[status] += 1
  return coverage
}

export function calculateFreshness(
  status: ReportingSubmissionStatus | undefined,
  dueOn: Date,
  now = new Date(),
): FreshnessStatus {
  if (!status) return 'missing'
  if (status === 'approved') return 'current'
  if (now > dueOn) return 'late'
  return 'due'
}

export async function getReportingCoverage(
  database: Pick<
    PrismaClient,
    'reportingPeriod' | 'reportingRequirement' | 'reportingSubmission'
  >,
  reportingPeriodId: string,
  now = new Date(),
) {
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  const [requirements, submissions] = await Promise.all([
    database.reportingRequirement.findMany({
      where: { reportingPeriodId },
      include: { school: true },
    }),
    database.reportingSubmission.findMany({ where: { reportingPeriodId } }),
  ])
  const bySchool = new Map(submissions.map((item) => [item.schoolId, item]))
  return {
    period,
    coverage: calculateCoverage(
      requirements.length,
      submissions.map((item) => item.status),
    ),
    schools: requirements.map((requirement) => {
      const submission = bySchool.get(requirement.schoolId)
      return {
        school: requirement.school,
        submission,
        freshness: calculateFreshness(
          submission?.status,
          period.submissionDueOn,
          now,
        ),
      }
    }),
  }
}

export async function listMissingSchools(
  database: Parameters<typeof getReportingCoverage>[0],
  reportingPeriodId: string,
) {
  const result = await getReportingCoverage(database, reportingPeriodId)
  return result.schools.filter((item) => !item.submission)
}

export async function listReturnedSubmissions(
  database: Pick<PrismaClient, 'reportingSubmission'>,
  reportingPeriodId: string,
) {
  return database.reportingSubmission.findMany({
    where: { reportingPeriodId, status: 'returned' },
    include: { school: true },
  })
}
