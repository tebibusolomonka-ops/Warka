import type { PrismaClient } from '@prisma/client'
import { requireBureauPermission } from './bureauAccess.js'
import { createReportingSnapshotEvidence } from './reportingSnapshotEvidence.js'
import { validateReportingSnapshot } from './reportingValidation.js'

type SubmittedAggregate = {
  schoolId: string
  reportingPeriodId: string
  status: string
  currentVersion: number
  acceptedVersion: number | null
  versions: {
    version: number
    snapshot: unknown
    snapshotChecksum: string | null
  }[]
}

export function validateRegionalReporting(
  reportingPeriodId: string,
  requiredSchoolIds: string[],
  submissions: SubmittedAggregate[],
) {
  const required = new Set(requiredSchoolIds)
  const seen = new Set<string>()
  const issues: {
    schoolId: string | null
    code: string
    severity: 'warning' | 'blocking'
  }[] = []
  for (const schoolId of required) {
    if (!submissions.some((item) => item.schoolId === schoolId))
      issues.push({
        schoolId,
        code: 'REPORTING_REQUIRED_SCHOOL_MISSING',
        severity: 'warning',
      })
  }
  for (const submission of submissions) {
    const { schoolId } = submission
    if (seen.has(schoolId))
      issues.push({
        schoolId,
        code: 'REPORTING_DUPLICATE_SCHOOL_SUBMISSION',
        severity: 'blocking',
      })
    seen.add(schoolId)
    if (
      submission.reportingPeriodId !== reportingPeriodId ||
      !required.has(schoolId)
    ) {
      issues.push({
        schoolId,
        code: 'REPORTING_SCOPE_MISMATCH',
        severity: 'blocking',
      })
      continue
    }
    if (!['submitted', 'underReview', 'approved'].includes(submission.status))
      continue
    const versionNumber =
      submission.status === 'approved'
        ? submission.acceptedVersion
        : submission.currentVersion
    const version = submission.versions.find(
      (item) => item.version === versionNumber,
    )
    if (!version) {
      issues.push({
        schoolId,
        code: 'REPORTING_VERSION_MISSING',
        severity: 'blocking',
      })
      continue
    }
    const validation = validateReportingSnapshot(version.snapshot)
    issues.push(
      ...validation.blocking.map((code) => ({
        schoolId,
        code,
        severity: 'blocking' as const,
      })),
    )
    issues.push(
      ...validation.warnings.map((code) => ({
        schoolId,
        code,
        severity: 'warning' as const,
      })),
    )
    if (validation.ready) {
      const expected = createReportingSnapshotEvidence(
        version.snapshot,
      ).checksum
      if (version.snapshotChecksum && version.snapshotChecksum !== expected)
        issues.push({
          schoolId,
          code: 'REPORTING_SNAPSHOT_CHECKSUM_MISMATCH',
          severity: 'blocking',
        })
      if (!version.snapshotChecksum)
        issues.push({
          schoolId,
          code: 'REPORTING_LEGACY_CHECKSUM_UNAVAILABLE',
          severity: 'warning',
        })
    }
  }
  return {
    requiredSchoolCount: required.size,
    receivedSchoolCount: [...seen].filter((schoolId) => required.has(schoolId))
      .length,
    issues,
    blocking: issues.filter((issue) => issue.severity === 'blocking'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  }
}

export async function getRegionalReportingValidation(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  reportingPeriodId: string,
) {
  await requireBureauPermission(database, actorUserId, organizationId, 'view')
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  if (period.organizationId !== organizationId)
    throw new Error('Reporting scope mismatch')
  const [requirements, submissions] = await Promise.all([
    database.reportingRequirement.findMany({
      where: { reportingPeriodId },
      select: { schoolId: true },
    }),
    database.reportingSubmission.findMany({
      where: { reportingPeriodId },
      select: {
        schoolId: true,
        reportingPeriodId: true,
        status: true,
        currentVersion: true,
        acceptedVersion: true,
        versions: {
          select: { version: true, snapshot: true, snapshotChecksum: true },
        },
      },
    }),
  ])
  return validateRegionalReporting(
    reportingPeriodId,
    requirements.map((item) => item.schoolId),
    submissions,
  )
}
