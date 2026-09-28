import { Prisma, type PrismaClient } from '@prisma/client'

export type GradebookIssueCode =
  'MISSING_MARK' | 'ABSENT' | 'PENDING_MAKE_UP' | 'MARK_OUT_OF_RANGE'

export class GradebookContextError extends Error {}

export async function getGradebookCompleteness(
  database: PrismaClient,
  schoolId: string,
  assessmentId: string,
) {
  const assessment = await database.assessment.findFirst({
    where: { id: assessmentId, schoolId },
    select: { academicYearId: true, schoolClassId: true, maximumScore: true },
  })
  if (!assessment) throw new GradebookContextError('Assessment not found')
  const [enrollments, marks, participations] = await Promise.all([
    database.enrollment.findMany({
      where: {
        schoolId,
        academicYearId: assessment.academicYearId,
        schoolClassId: assessment.schoolClassId,
        status: 'approved',
      },
      select: {
        id: true,
        studentId: true,
        student: {
          select: { studentReference: true, givenName: true, familyName: true },
        },
      },
      orderBy: { student: { studentReference: 'asc' } },
    }),
    database.mark.findMany({
      where: { schoolId, assessmentId },
      select: { id: true, enrollmentId: true, score: true },
    }),
    database.assessmentParticipation.findMany({
      where: { schoolId, session: { schedule: { assessmentId } } },
      select: {
        id: true,
        enrollmentId: true,
        status: true,
        makeUpAssessments: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const markByEnrollment = new Map(
    marks.map((item) => [item.enrollmentId, item]),
  )
  const participationByEnrollment = new Map<
    string,
    (typeof participations)[number]
  >()
  for (const item of participations)
    if (!participationByEnrollment.has(item.enrollmentId))
      participationByEnrollment.set(item.enrollmentId, item)
  const rows = enrollments.map((enrollment) => {
    const mark = markByEnrollment.get(enrollment.id)
    const participation = participationByEnrollment.get(enrollment.id)
    const pendingMakeUp =
      participation?.makeUpAssessments.some((item) =>
        ['requested', 'approved', 'scheduled'].includes(item.status),
      ) ?? false
    const issues: GradebookIssueCode[] = []
    if (!mark) issues.push('MISSING_MARK')
    if (participation?.status === 'absent') issues.push('ABSENT')
    if (pendingMakeUp) issues.push('PENDING_MAKE_UP')
    if (
      mark &&
      (mark.score.lt(new Prisma.Decimal(0)) ||
        mark.score.gt(assessment.maximumScore))
    )
      issues.push('MARK_OUT_OF_RANGE')
    const blockingIssues = issues.filter((issue) => issue !== 'ABSENT')
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      studentReference: enrollment.student.studentReference,
      studentName:
        `${enrollment.student.givenName} ${enrollment.student.familyName ?? ''}`.trim(),
      participation: participation?.status ?? null,
      makeUpStatus: participation?.makeUpAssessments[0]?.status ?? null,
      mark: mark ? { id: mark.id, score: mark.score.toFixed(2) } : null,
      issues,
      blockingIssues,
    }
  })
  const counts = {
    eligible: rows.length,
    marksEntered: rows.filter((row) => row.mark).length,
    marksMissing: rows.filter((row) => !row.mark).length,
    absent: rows.filter((row) => row.participation === 'absent').length,
    pendingMakeUp: rows.filter((row) => row.issues.includes('PENDING_MAKE_UP'))
      .length,
    invalidMarks: rows.filter((row) => row.issues.includes('MARK_OUT_OF_RANGE'))
      .length,
  }
  return {
    assessmentId,
    counts,
    complete:
      rows.length > 0 && rows.every((row) => row.blockingIssues.length === 0),
    rows,
  }
}
