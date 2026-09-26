import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { requireSchoolImportPermission } from './importJobs.js'

export const SchoolExportTypeSchema = z.enum([
  'studentRoster',
  'approvedEnrollmentRoster',
  'publishedResults',
])

export type SchoolExportType = z.infer<typeof SchoolExportTypeSchema>

export function serializeCsv(rows: Array<Array<string | number | null>>) {
  return (
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = value === null ? '' : String(value)
            const safe =
              typeof value === 'string' && /^[=+\-@]/u.test(text.trimStart())
                ? `'${text}`
                : text
            return `"${safe.replaceAll('"', '""')}"`
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  )
}

export async function createSchoolExport(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  type: SchoolExportType,
) {
  z.uuid().parse(schoolId)
  const exportType = SchoolExportTypeSchema.parse(type)
  await requireSchoolImportPermission(database, actorUserId, schoolId)
  let rows: Array<Array<string | number | null>>
  if (exportType === 'studentRoster') {
    const enrollments = await database.enrollment.findMany({
      where: { schoolId, status: { in: ['draft', 'approved'] } },
      select: {
        student: {
          select: {
            studentReference: true,
            givenName: true,
            familyName: true,
            dateOfBirth: true,
          },
        },
        academicYear: { select: { name: true } },
        gradeLevel: { select: { name: true } },
        schoolClass: { select: { name: true } },
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    rows = [
      [
        'studentReference',
        'givenName',
        'familyName',
        'dateOfBirth',
        'academicYear',
        'gradeLevel',
        'class',
        'enrollmentStatus',
      ],
      ...enrollments.map((row) => [
        row.student.studentReference,
        row.student.givenName,
        row.student.familyName,
        row.student.dateOfBirth?.toISOString().slice(0, 10) ?? '',
        row.academicYear.name,
        row.gradeLevel.name,
        row.schoolClass?.name ?? '',
        row.status,
      ]),
    ]
  } else if (exportType === 'approvedEnrollmentRoster') {
    const enrollments = await database.enrollment.findMany({
      where: { schoolId, status: 'approved' },
      select: {
        student: {
          select: { studentReference: true, givenName: true, familyName: true },
        },
        academicYear: { select: { name: true } },
        gradeLevel: { select: { name: true } },
        schoolClass: { select: { name: true } },
        approvedAt: true,
      },
      orderBy: { approvedAt: 'asc' },
    })
    rows = [
      [
        'studentReference',
        'givenName',
        'familyName',
        'academicYear',
        'gradeLevel',
        'class',
        'approvedAt',
      ],
      ...enrollments.map((row) => [
        row.student.studentReference,
        row.student.givenName,
        row.student.familyName,
        row.academicYear.name,
        row.gradeLevel.name,
        row.schoolClass?.name ?? '',
        row.approvedAt?.toISOString() ?? '',
      ]),
    ]
  } else {
    const results = await database.publishedResult.findMany({
      where: { schoolId, resultSet: { status: 'published' } },
      select: {
        student: { select: { studentReference: true } },
        resultSet: {
          select: {
            academicYear: { select: { name: true } },
            gradingPeriod: { select: { name: true } },
            schoolClass: { select: { name: true } },
            subject: { select: { name: true } },
            publishedAt: true,
          },
        },
        currentPercentage: true,
        currentGradeLabel: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    rows = [
      [
        'studentReference',
        'academicYear',
        'gradingPeriod',
        'class',
        'subject',
        'percentage',
        'grade',
        'publishedAt',
      ],
      ...results.map((row) => [
        row.student.studentReference,
        row.resultSet.academicYear.name,
        row.resultSet.gradingPeriod.name,
        row.resultSet.schoolClass.name,
        row.resultSet.subject.name,
        row.currentPercentage.toString(),
        row.currentGradeLabel,
        row.resultSet.publishedAt?.toISOString() ?? '',
      ]),
    ]
  }
  const csv = serializeCsv(rows)
  await recordAuditEvent(database, {
    schoolId,
    actorUserId,
    action: 'schoolData.exported',
    resourceType: 'school',
    resourceId: schoolId,
    metadata: { exportType, rowCount: rows.length - 1 },
  })
  return { csv, rowCount: rows.length - 1 }
}
