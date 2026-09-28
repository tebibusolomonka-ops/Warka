import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import {
  editableCourseworkDueAt,
  completeSubmissionReview,
  SubmissionReviewError,
} from './submissionReviews.js'

vi.mock('./courseworkAudience.js', () => ({
  mayManageCourseworkAssignment: vi.fn(),
}))
vi.mock('./assignmentExtensions.js', () => ({
  effectiveCourseworkDueAt: vi.fn().mockResolvedValue(new Date('2026-09-01')),
}))
const id = '00000000-0000-4000-8000-000000000001'
const now = new Date('2026-09-28')
function fixture(
  reviewStatus: 'pending' | 'reviewed' | 'returned' = 'pending',
) {
  const review = {
    id,
    status: reviewStatus,
    resubmissionAllowed: reviewStatus === 'returned',
    resubmissionDueAt: new Date('2026-10-05'),
  }
  const database = {
    submissionRevision: {
      findUnique: vi.fn().mockResolvedValue({
        id,
        submittedAt: new Date('2026-09-01'),
        submission: {
          schoolId: id,
          assignmentId: id,
          assignment: { id, status: 'closed' },
        },
        review,
      }),
      findFirst: vi.fn().mockResolvedValue({ review }),
    },
    submissionReview: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(review),
    },
  } as unknown as PrismaClient
  return database
}
beforeEach(() =>
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(true),
)
describe('submission review', () => {
  it('records explicit return permission and deadline for a submitted revision', async () => {
    const database = fixture()
    await completeSubmissionReview(
      database,
      id,
      id,
      id,
      id,
      { status: 'returned', resubmissionDueAt: '2026-10-05T00:00:00.000Z' },
      now,
    )
    expect(database.submissionReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'returned',
          reviewedById: id,
          resubmissionAllowed: true,
        }),
      }),
    )
    await expect(
      editableCourseworkDueAt(
        database,
        { id, status: 'closed', dueAt: new Date('2026-09-01') },
        id,
        now,
      ),
    ).resolves.toBeNull()
    vi.mocked(database.submissionRevision.findFirst).mockResolvedValue({
      review: {
        ...(await database.submissionReview.findUniqueOrThrow({
          where: { id },
        })),
        status: 'returned',
        resubmissionAllowed: true,
      },
    } as never)
    await expect(
      editableCourseworkDueAt(
        database,
        { id, status: 'closed', dueAt: new Date('2026-09-01') },
        id,
        now,
      ),
    ).resolves.toEqual(new Date('2026-10-05'))
  })
  it('rejects unrelated teachers and changes to completed reviews', async () => {
    const database = fixture()
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(false)
    await expect(
      completeSubmissionReview(
        database,
        id,
        id,
        id,
        id,
        { status: 'reviewed' },
        now,
      ),
    ).rejects.toBeInstanceOf(SubmissionReviewError)
    const completed = fixture('reviewed')
    await expect(
      completeSubmissionReview(
        completed,
        id,
        id,
        id,
        id,
        { status: 'reviewed' },
        now,
      ),
    ).rejects.toBeInstanceOf(SubmissionReviewError)
  })
})
