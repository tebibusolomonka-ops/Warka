import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { canRecordAssessment } from './marks.js'
import { assertResultSetDraft } from './results.js'

export const MarkModerationRequestSchema = z.strictObject({
  schoolId: z.uuid(),
  markId: z.uuid(),
  proposedScore: z.string().regex(/^\d{1,6}(\.\d{1,2})?$/),
  reason: z.string().trim().min(5).max(500),
})

export class MarkModerationStateError extends Error {}

export async function requestMarkModeration(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof MarkModerationRequestSchema>,
) {
  z.uuid().parse(actorId)
  const value = MarkModerationRequestSchema.parse(input)
  const mark = await database.mark.findFirst({
    where: { id: value.markId, schoolId: value.schoolId },
    include: { assessment: true },
  })
  if (!mark) throw new MarkModerationStateError('Mark not found')
  if (!(await canRecordAssessment(database, actorId, mark.assessment))) {
    throw new MarkModerationStateError(
      'Current class and subject access required',
    )
  }
  await assertResultSetDraft(database, mark.assessment)
  const proposedScore = new Prisma.Decimal(value.proposedScore)
  if (
    proposedScore.lt(0) ||
    proposedScore.gt(mark.assessment.maximumScore) ||
    proposedScore.eq(mark.score)
  ) {
    throw new MarkModerationStateError(
      'Proposed mark must be a different permitted score',
    )
  }
  try {
    return await database.markModerationRequest.create({
      data: {
        schoolId: value.schoolId,
        markId: mark.id,
        originalScore: mark.score,
        proposedScore,
        reason: value.reason,
        requestedById: actorId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new MarkModerationStateError(
        'A moderation request is already pending',
      )
    }
    throw error
  }
}
