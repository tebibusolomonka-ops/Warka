import type { PrismaClient } from '@prisma/client'
import { getGradebookCompleteness } from './gradebookCompleteness.js'
import {
  previewResults,
  ResultContextSchema,
  type ResultContext,
} from './results.js'

export type PublicationIssue = {
  code:
    | 'NO_ASSESSMENTS'
    | 'INCOMPLETE_GRADEBOOK'
    | 'PENDING_MAKE_UP'
    | 'PENDING_MODERATION'
    | 'UNLOCKED_GRADEBOOK'
    | 'RESULT_CALCULATION'
    | 'RESULT_NOT_SUBMITTED'
    | 'ALREADY_PUBLISHED'
  assessmentId?: string
}

export async function getResultPublicationReadiness(
  database: PrismaClient,
  actorId: string,
  input: ResultContext,
) {
  const context = ResultContextSchema.parse(input)
  const preview = await previewResults(database, actorId, context)
  const issues: PublicationIssue[] = []
  const warnings: string[] = []
  if (!preview.assessments.length) issues.push({ code: 'NO_ASSESSMENTS' })
  for (const assessment of preview.assessments) {
    const completeness = await getGradebookCompleteness(
      database,
      context.schoolId,
      assessment.id,
    )
    if (!completeness.complete)
      issues.push({ code: 'INCOMPLETE_GRADEBOOK', assessmentId: assessment.id })
    if (completeness.counts.pendingMakeUp > 0)
      issues.push({ code: 'PENDING_MAKE_UP', assessmentId: assessment.id })
  }
  const [moderation, lock] = await Promise.all([
    database.markModerationRequest.findFirst({
      where: {
        schoolId: context.schoolId,
        status: 'pending',
        mark: { assessment: context },
      },
      select: { id: true },
    }),
    database.gradebookLock.findUnique({
      where: { GradebookLock_context_key: context },
      select: { locked: true },
    }),
  ])
  if (moderation) issues.push({ code: 'PENDING_MODERATION' })
  if (!lock?.locked) issues.push({ code: 'UNLOCKED_GRADEBOOK' })
  if (!preview.complete || !preview.gradingSchemeReady)
    issues.push({ code: 'RESULT_CALCULATION' })
  if (preview.status === 'published') issues.push({ code: 'ALREADY_PUBLISHED' })
  else if (preview.status !== 'pending')
    issues.push({ code: 'RESULT_NOT_SUBMITTED' })
  if (preview.rows.some((row) => row.calculation.status !== 'ready'))
    warnings.push('Some student calculations are not ready')
  return {
    ready: issues.length === 0,
    warnings,
    blockingIssues: issues,
    resultSetId: preview.resultSetId,
    resultStatus: preview.status,
  }
}
