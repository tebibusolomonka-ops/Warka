import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  eligibleCourseworkEnrollment,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'

export class RubricScoringError extends Error {}
const points = z.string().regex(/^\d{1,3}(?:\.\d{1,2})?$/)
export const ScoreSubmissionRubricSchema = z.strictObject({
  criteria: z
    .array(z.strictObject({ criterionId: z.uuid(), points }))
    .min(1)
    .max(20),
})

export async function scoreSubmissionRubric(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  revisionId: string,
  input: unknown,
  now = new Date(),
) {
  const value = ScoreSubmissionRubricSchema.parse(input)
  return database.$transaction(
    async (transaction) => {
      const revision = await transaction.submissionRevision.findUnique({
        where: { id: revisionId },
        include: { submission: { include: { assignment: true } } },
      })
      if (
        !revision?.submittedAt ||
        revision.submission.schoolId !== schoolId ||
        revision.submission.assignmentId !== assignmentId
      )
        throw new RubricScoringError('Submitted revision required')
      const assignment = revision.submission.assignment
      if (
        !(await mayManageCourseworkAssignment(
          transaction as PrismaClient,
          actorId,
          assignment,
        ))
      )
        throw new RubricScoringError('Marking authority required')
      if (
        !(await eligibleCourseworkEnrollment(
          transaction as PrismaClient,
          revision.submission.studentId,
          assignment,
          now,
        ))
      )
        throw new RubricScoringError(
          'Student is outside the assignment audience',
        )
      const rubric = await transaction.courseworkRubric.findFirst({
        where: { schoolId, assignmentId },
        include: { criteria: { orderBy: { sortOrder: 'asc' } } },
      })
      if (!rubric) throw new RubricScoringError('Assignment rubric required')
      if (
        value.criteria.length !== rubric.criteria.length ||
        new Set(value.criteria.map((item) => item.criterionId)).size !==
          rubric.criteria.length
      )
        throw new RubricScoringError('Every rubric criterion needs one score')
      const byId = new Map(
        value.criteria.map((item) => [
          item.criterionId,
          new Prisma.Decimal(item.points),
        ]),
      )
      let total = new Prisma.Decimal(0)
      const criterionScores = rubric.criteria.map((criterion) => {
        const score = byId.get(criterion.id)
        if (
          !score ||
          score.lessThan(0) ||
          score.greaterThan(criterion.maxPoints)
        )
          throw new RubricScoringError(
            'Criterion score is outside its allowed range',
          )
        total = total.plus(score)
        return { criterionId: criterion.id, points: score }
      })
      const latest = await transaction.rubricScore.findFirst({
        where: { revisionId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      if (!rubric.frozenAt)
        await transaction.courseworkRubric.update({
          where: { id: rubric.id, frozenAt: null },
          data: { frozenAt: now },
        })
      return transaction.rubricScore.create({
        data: {
          revisionId,
          rubricId: rubric.id,
          version: (latest?.version ?? 0) + 1,
          totalPoints: total,
          scoredById: actorId,
          criteria: { create: criterionScores },
        },
        include: { criteria: true },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function latestRubricScore(
  database: PrismaClient,
  revisionId: string,
) {
  return database.rubricScore.findFirst({
    where: { revisionId },
    orderBy: { version: 'desc' },
    include: { criteria: { include: { criterion: true } } },
  })
}
