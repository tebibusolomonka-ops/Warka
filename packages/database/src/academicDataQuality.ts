import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { QualityFinding } from './studentDataQuality.js'

export async function checkAcademicDataQuality(
  database: PrismaClient,
  schoolId: string,
): Promise<QualityFinding[]> {
  z.uuid().parse(schoolId)
  const [assessments, marks, results, locks] = await Promise.all([
    database.assessment.findMany({
      where: { schoolId },
      select: {
        id: true,
        maximumScore: true,
        weight: true,
        schoolClass: { select: { academicYearId: true } },
        academicYearId: true,
      },
    }),
    database.mark.findMany({
      where: { schoolId },
      include: {
        assessment: {
          select: {
            schoolId: true,
            academicYearId: true,
            schoolClassId: true,
            maximumScore: true,
          },
        },
        enrollment: {
          select: { schoolId: true, academicYearId: true, schoolClassId: true },
        },
      },
    }),
    database.resultSet.findMany({
      where: { schoolId, status: 'published' },
      select: {
        id: true,
        publishedAt: true,
        publishedById: true,
        results: { select: { id: true, percentage: true, gradeLabel: true } },
      },
    }),
    database.gradebookLock.findMany({
      where: { schoolId, locked: true },
      select: { id: true, lockedAt: true },
    }),
  ])
  const findings: QualityFinding[] = []
  const add = (
    entityType: string,
    entityId: string,
    code: string,
    summary: string,
  ) =>
    findings.push({
      category: 'academic',
      severity: 'blocking',
      code,
      summary,
      entityType,
      entityId,
    })
  for (const assessment of assessments) {
    if (assessment.maximumScore.lte(0) || assessment.weight.lte(0))
      add(
        'assessment',
        assessment.id,
        'ASSESSMENT_RANGE_INVALID',
        'Assessment maximum or weight is invalid',
      )
    if (assessment.schoolClass.academicYearId !== assessment.academicYearId)
      add(
        'assessment',
        assessment.id,
        'ASSESSMENT_YEAR_MISMATCH',
        'Assessment class and academic year differ',
      )
  }
  for (const mark of marks) {
    if (mark.score.lt(0) || mark.score.gt(mark.assessment.maximumScore))
      add(
        'mark',
        mark.id,
        'MARK_OUT_OF_RANGE',
        'Recorded mark is outside the assessment range',
      )
    if (
      mark.assessment.schoolId !== schoolId ||
      mark.enrollment.schoolId !== schoolId ||
      mark.assessment.academicYearId !== mark.enrollment.academicYearId ||
      mark.assessment.schoolClassId !== mark.enrollment.schoolClassId
    )
      add(
        'mark',
        mark.id,
        'MARK_CONTEXT_MISMATCH',
        'Mark assessment and enrollment contexts differ',
      )
  }
  for (const result of results) {
    if (!result.publishedAt || !result.publishedById)
      add(
        'resultSet',
        result.id,
        'PUBLISHED_RESULT_HISTORY_MISSING',
        'Published result lacks publication metadata',
      )
    for (const row of result.results)
      if (
        row.percentage.lt(0) ||
        row.percentage.gt(100) ||
        !row.gradeLabel.trim()
      )
        add(
          'publishedResult',
          row.id,
          'PUBLISHED_RESULT_VALUE_INVALID',
          'Published result value is invalid',
        )
  }
  for (const lock of locks)
    if (!lock.lockedAt)
      add(
        'gradebookLock',
        lock.id,
        'GRADEBOOK_LOCK_TIME_MISSING',
        'Locked gradebook lacks lock time',
      )
  return findings
}
