import { Prisma, type PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  eligibleCourseworkEnrollment,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import { RubricScoringError, scoreSubmissionRubric } from './rubricScoring.js'

vi.mock('./courseworkAudience.js', () => ({
  eligibleCourseworkEnrollment: vi.fn(),
  mayManageCourseworkAssignment: vi.fn(),
}))
const id = '00000000-0000-4000-8000-000000000001'
const second = '00000000-0000-4000-8000-000000000002'
function fixture(frozenAt: Date | null = null) {
  const assignment = { id, schoolId: id }
  const transaction = {
    submissionRevision: {
      findUnique: vi.fn().mockResolvedValue({
        id,
        submittedAt: new Date(),
        submission: {
          schoolId: id,
          assignmentId: id,
          studentId: id,
          assignment,
        },
      }),
    },
    courseworkRubric: {
      findFirst: vi.fn().mockResolvedValue({
        id,
        frozenAt,
        criteria: [
          { id, maxPoints: new Prisma.Decimal(10) },
          { id: second, maxPoints: new Prisma.Decimal(20) },
        ],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    rubricScore: {
      findFirst: vi.fn().mockResolvedValue({ version: 1 }),
      create: vi.fn().mockResolvedValue({ id, version: 2 }),
    },
  }
  const database = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}
beforeEach(() => {
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(true)
  vi.mocked(eligibleCourseworkEnrollment)
    .mockReset()
    .mockResolvedValue({ id } as never)
})
describe('rubric scoring', () => {
  it('freezes the rubric and creates a new score version, separate from marks', async () => {
    const { database, transaction } = fixture()
    await scoreSubmissionRubric(database, id, id, id, id, {
      criteria: [
        { criterionId: id, points: '9.50' },
        { criterionId: second, points: '18.00' },
      ],
    })
    expect(transaction.courseworkRubric.update).toHaveBeenCalled()
    expect(transaction.rubricScore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          totalPoints: new Prisma.Decimal('27.50'),
        }),
      }),
    )
  })
  it('rejects out of range, duplicate, and missing criterion scores', async () => {
    const { database, transaction } = fixture()
    await expect(
      scoreSubmissionRubric(database, id, id, id, id, {
        criteria: [
          { criterionId: id, points: '11' },
          { criterionId: second, points: '18' },
        ],
      }),
    ).rejects.toBeInstanceOf(RubricScoringError)
    await expect(
      scoreSubmissionRubric(database, id, id, id, id, {
        criteria: [
          { criterionId: id, points: '8' },
          { criterionId: id, points: '9' },
        ],
      }),
    ).rejects.toBeInstanceOf(RubricScoringError)
    expect(transaction.rubricScore.create).not.toHaveBeenCalled()
  })
  it('denies unrelated teachers and ineligible students', async () => {
    const { database } = fixture()
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(false)
    await expect(
      scoreSubmissionRubric(database, id, id, id, id, {
        criteria: [
          { criterionId: id, points: '9' },
          { criterionId: second, points: '18' },
        ],
      }),
    ).rejects.toBeInstanceOf(RubricScoringError)
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(true)
    vi.mocked(eligibleCourseworkEnrollment).mockResolvedValue(null)
    await expect(
      scoreSubmissionRubric(database, id, id, id, id, {
        criteria: [
          { criterionId: id, points: '9' },
          { criterionId: second, points: '18' },
        ],
      }),
    ).rejects.toBeInstanceOf(RubricScoringError)
  })
})
