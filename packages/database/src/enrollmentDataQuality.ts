import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { QualityFinding } from './studentDataQuality.js'

export async function checkEnrollmentDataQuality(
  database: PrismaClient,
  schoolId: string,
): Promise<QualityFinding[]> {
  z.uuid().parse(schoolId)
  const rows = await database.enrollment.findMany({
    where: { schoolId },
    include: { academicYear: true, gradeLevel: true, schoolClass: true },
    orderBy: { id: 'asc' },
  })
  const findings: QualityFinding[] = []
  const approved = new Set<string>()
  const add = (id: string, code: string, summary: string) =>
    findings.push({
      category: 'enrollment',
      severity: 'blocking',
      code,
      summary,
      entityType: 'enrollment',
      entityId: id,
    })
  for (const row of rows) {
    if (
      row.academicYear.schoolId !== schoolId ||
      row.gradeLevel.schoolId !== schoolId
    )
      add(
        row.id,
        'ENROLLMENT_SCHOOL_STRUCTURE_MISMATCH',
        'Enrollment academic structure is outside its school',
      )
    if (
      row.schoolClass &&
      (row.schoolClass.schoolId !== schoolId ||
        row.schoolClass.academicYearId !== row.academicYearId ||
        row.schoolClass.gradeLevelId !== row.gradeLevelId)
    )
      add(
        row.id,
        'ENROLLMENT_CLASS_CONTEXT_MISMATCH',
        'Enrollment class does not match year and grade',
      )
    if (row.status === 'approved' && !row.withdrawnAt) {
      if (!row.schoolClass)
        add(
          row.id,
          'ENROLLMENT_APPROVED_CLASS_MISSING',
          'Approved enrollment has no class',
        )
      const key = `${row.studentId}:${row.academicYearId}`
      if (approved.has(key))
        add(
          row.id,
          'ENROLLMENT_ACTIVE_CONTEXT_CONFLICT',
          'Multiple active enrollments share a student and academic year',
        )
      approved.add(key)
    }
    if (row.status === 'approved' && !row.approvedAt)
      add(
        row.id,
        'ENROLLMENT_APPROVAL_TIME_MISSING',
        'Approved enrollment has no approval time',
      )
    if (row.status === 'withdrawn' && !row.withdrawnAt)
      add(
        row.id,
        'ENROLLMENT_WITHDRAWAL_TIME_MISSING',
        'Withdrawn enrollment has no withdrawal time',
      )
  }
  return findings
}
