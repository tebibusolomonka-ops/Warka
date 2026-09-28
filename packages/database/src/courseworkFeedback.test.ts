import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import {
  CourseworkFeedbackError,
  CourseworkFeedbackTextSchema,
  saveDraftCourseworkFeedback,
  releaseCourseworkFeedback,
} from './courseworkFeedback.js'

vi.mock('./courseworkAudience.js', () => ({
  mayManageCourseworkAssignment: vi.fn(),
}))
vi.mock('./courseworkNotifications.js', () => ({
  notifyCoursework: vi.fn().mockResolvedValue({ count: 1 }),
}))
const id = '00000000-0000-4000-8000-000000000001'
function fixture(
  status: 'draft' | 'released' = 'draft',
  reviewStatus = 'reviewed',
) {
  const transaction = {
    submissionRevision: {
      findUnique: vi.fn().mockResolvedValue({
        id,
        submittedAt: new Date(),
        review: { status: reviewStatus },
        submission: {
          schoolId: id,
          assignmentId: id,
          studentId: id,
          assignment: { id },
        },
      }),
    },
    courseworkFeedback: {
      findUnique: vi.fn().mockResolvedValue({ id, status }),
      update: vi.fn().mockResolvedValue({ id }),
      create: vi.fn().mockResolvedValue({ id }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id, status: 'released' }),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ userId: id }) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  }
  const database = {
    ...transaction,
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}
beforeEach(() =>
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(true),
)
describe('coursework feedback', () => {
  it('rejects HTML and requires completed review before draft feedback', async () => {
    expect(() => CourseworkFeedbackTextSchema.parse('<b>unsafe</b>')).toThrow()
    const { database } = fixture('draft', 'pending')
    await expect(
      saveDraftCourseworkFeedback(database, id, id, id, id, 'Helpful feedback'),
    ).rejects.toBeInstanceOf(CourseworkFeedbackError)
  })
  it('releases only once and notifies without copying feedback text', async () => {
    const { database, transaction } = fixture()
    await releaseCourseworkFeedback(database, id, id, id, id)
    expect(transaction.courseworkFeedback.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'draft' }),
        data: expect.objectContaining({ status: 'released' }),
      }),
    )
    expect(transaction.studentAccess.findUnique).toHaveBeenCalled()
    const released = fixture('released')
    await expect(
      releaseCourseworkFeedback(released.database, id, id, id, id),
    ).rejects.toBeInstanceOf(CourseworkFeedbackError)
    expect(
      released.transaction.courseworkFeedback.updateMany,
    ).not.toHaveBeenCalled()
  })
  it('prevents editing feedback after release', async () => {
    const { database } = fixture('released')
    await expect(
      saveDraftCourseworkFeedback(database, id, id, id, id, 'Changed'),
    ).rejects.toBeInstanceOf(CourseworkFeedbackError)
  })
})
