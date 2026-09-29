import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { requireBureauPermission } from './bureauAccess.js'
import { ReportingSnapshotSchema } from './reportingValidation.js'
import { serializeCsv } from './schoolExports.js'

export const ReportingExportTypeSchema = z.enum([
  'coverage',
  'enrollment',
  'academic',
  'transfers',
])
export type ReportingExportType = z.infer<typeof ReportingExportTypeSchema>

type ExportSchool = {
  id: string
  name: string
  submission: {
    status: string
    acceptedVersion: number | null
    versions: {
      version: number
      snapshot: unknown
      submittedAt: Date
    }[]
  } | null
}

export function buildReportingExportRows(
  periodName: string,
  schools: ExportSchool[],
  exportType: ReportingExportType,
) {
  const rows: Array<Array<string | number | null>> = [
    [
      'reportingPeriod',
      'schoolId',
      'schoolName',
      'acceptedVersion',
      'submittedAt',
      'category',
      'label',
      'value',
      'dataState',
    ],
  ]
  for (const school of schools) {
    const submission = school.submission
    const version =
      submission?.status === 'approved'
        ? submission.versions.find(
            (item) => item.version === submission.acceptedVersion,
          )
        : undefined
    if (exportType === 'coverage') {
      rows.push([
        periodName,
        school.id,
        school.name,
        version?.version ?? null,
        version?.submittedAt.toISOString() ?? null,
        'coverage',
        'status',
        submission?.status ?? 'missing',
        version ? 'reported' : 'notReported',
      ])
      continue
    }
    if (!version) continue
    const snapshot = ReportingSnapshotSchema.parse(version.snapshot)
    const base: Array<string | number | null> = [
      periodName,
      school.id,
      school.name,
      version.version,
      version.submittedAt.toISOString(),
    ]
    const add = (
      category: string,
      label: string,
      value: number | null,
      dataState = 'reported',
    ) => rows.push([...base, category, label, value, dataState])
    if (exportType === 'enrollment') {
      if (snapshot.enrollment.dataState !== 'reported')
        add('enrollment', 'total', null, snapshot.enrollment.dataState)
      else {
        add('enrollment', 'total', snapshot.enrollment.total)
        for (const item of snapshot.enrollment.byAcademicYear)
          add('academicYear', item.name, item.count)
        for (const item of snapshot.enrollment.byGradeLevel)
          add('gradeLevel', item.name, item.count)
      }
    } else if (exportType === 'academic') {
      if (snapshot.academic.dataState !== 'reported')
        add(
          'academic',
          'publishedResultCount',
          null,
          snapshot.academic.dataState,
        )
      else {
        add(
          'academic',
          'publishedResultCount',
          snapshot.academic.publishedResultCount,
        )
        for (const item of snapshot.academic.outcomes)
          add('outcome', item.gradeLabel, item.count)
      }
    } else {
      for (const [label, value] of Object.entries(snapshot.activity.transfers))
        add('transfer', label, value)
    }
  }
  return rows
}

export async function createReportingExport(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  reportingPeriodId: string,
  exportType: ReportingExportType,
) {
  await requireBureauPermission(database, actorUserId, organizationId, 'view')
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  if (period.organizationId !== organizationId)
    throw new Error('Reporting scope mismatch')
  const requirements = await database.reportingRequirement.findMany({
    where: { reportingPeriodId },
    include: { school: true },
    orderBy: { school: { name: 'asc' } },
  })
  const submissions = await database.reportingSubmission.findMany({
    where: { reportingPeriodId },
    include: {
      versions: {
        select: { version: true, snapshot: true, submittedAt: true },
      },
    },
  })
  const bySchool = new Map(submissions.map((item) => [item.schoolId, item]))
  const rows = buildReportingExportRows(
    period.name,
    requirements.map((item) => ({
      id: item.schoolId,
      name: item.school.name,
      submission: bySchool.get(item.schoolId) ?? null,
    })),
    exportType,
  )
  const csv = serializeCsv(rows)
  await recordAuditEvent(database, {
    organizationId,
    actorUserId,
    action: 'report.exported',
    resourceType: 'reportingPeriod',
    resourceId: reportingPeriodId,
    metadata: { exportType, rowCount: rows.length - 1 },
  })
  return { csv, rowCount: rows.length - 1 }
}
