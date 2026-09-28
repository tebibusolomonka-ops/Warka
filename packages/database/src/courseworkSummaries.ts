import type { PrismaClient } from '@prisma/client'

export type PersonalCourseworkRow = {
  dueAt: Date | string
  submittedAt: Date | string | null
  submissionStatus: string
  feedbackAvailable: boolean
}
export function summarizePersonalCoursework(rows: PersonalCourseworkRow[]) {
  return rows.reduce(
    (total, row) => {
      total.assigned++
      if (row.submissionStatus === 'submitted' && row.submittedAt) {
        total.submitted++
        if (new Date(row.submittedAt) > new Date(row.dueAt)) total.late++
      } else total.notSubmitted++
      if (row.feedbackAvailable) total.feedbackAvailable++
      return total
    },
    {
      assigned: 0,
      submitted: 0,
      notSubmitted: 0,
      late: 0,
      feedbackAvailable: 0,
    },
  )
}

export async function studentCourseworkSummary(
  database: PrismaClient,
  studentId: string,
  assignments: { id: string; dueAt: Date }[],
) {
  const rows = await Promise.all(
    assignments.map(async (assignment) => {
      const [submission, extension] = await Promise.all([
        database.courseworkSubmission.findUnique({
          where: {
            assignmentId_studentId: { assignmentId: assignment.id, studentId },
          },
          select: {
            status: true,
            submittedAt: true,
            revisions: {
              where: { submittedAt: { not: null } },
              orderBy: { revisionNumber: 'desc' },
              take: 1,
              select: {
                feedback: { select: { status: true, releasedAt: true } },
              },
            },
          },
        }),
        database.assignmentExtension.findFirst({
          where: { assignmentId: assignment.id, studentId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { extendedDueAt: true },
        }),
      ])
      return {
        dueAt: extension?.extendedDueAt ?? assignment.dueAt,
        submittedAt: submission?.submittedAt ?? null,
        submissionStatus: submission?.status ?? 'not_started',
        feedbackAvailable:
          submission?.revisions[0]?.feedback?.status === 'released' &&
          Boolean(submission.revisions[0].feedback.releasedAt),
      }
    }),
  )
  return summarizePersonalCoursework(rows)
}
