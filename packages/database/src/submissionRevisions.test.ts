import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { visibleCourseworkAssignmentForStudent } from './courseworkAudience.js'
import {
  saveDraftSubmissionRevision,
  submitCourseworkRevision,
  SubmissionRevisionError,
  SubmissionTextSchema,
  withdrawCourseworkSubmission,
} from './submissionRevisions.js'

vi.mock('./courseworkAudience.js', () => ({
  visibleCourseworkAssignmentForStudent: vi.fn(),
}))
const id = '00000000-0000-4000-8000-000000000001'
const now = new Date('2026-09-01')
function fixture(
  latest: {
    id: string
    revisionNumber: number
    submittedAt: Date | null
  } | null = null,
) {
  const transaction = {
    courseworkSubmission: {
      findUnique: vi.fn().mockResolvedValue({ id, status: 'submitted' }),
      update: vi.fn().mockResolvedValue({}),
    },
    submissionRevision: {
      findFirst: vi.fn().mockResolvedValue(latest),
      create: vi
        .fn()
        .mockResolvedValue({
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id }),
    },
  }
  const database = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    courseworkSubmission: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient
  return { database, transaction }
}
beforeEach(() => {
  vi.mocked(visibleCourseworkAssignmentForStudent)
    .mockReset()
    .mockResolvedValue({
      studentId: id,
      assignment: { dueAt: new Date('2026-12-01') },
    } as never)
})
describe('submission revisions', () => {
  it('rejects HTML and creates a new revision after a submitted one', async () => {
    expect(() =>
      SubmissionTextSchema.parse('<script>unsafe</script>'),
    ).toThrow()
    const { database, transaction } = fixture({
      id,
      revisionNumber: 2,
      submittedAt: now,
    })
    await saveDraftSubmissionRevision(database, id, id, 'Revised response', now)
    expect(transaction.submissionRevision.create).toHaveBeenCalledWith({
      data: {
        submissionId: id,
        revisionNumber: 3,
        textResponse: 'Revised response',
      },
    })
    expect(transaction.submissionRevision.update).not.toHaveBeenCalled()
  })
  it('sets submittedAt when student submits an editable revision', async () => {
    const { database, transaction } = fixture({
      id,
      revisionNumber: 2,
      submittedAt: null,
    })
    await submitCourseworkRevision(database, id, id, now)
    expect(transaction.submissionRevision.updateMany).toHaveBeenCalledWith({
      where: { id, submittedAt: null },
      data: { submittedAt: now },
    })
    expect(transaction.courseworkSubmission.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: 'submitted', submittedAt: now },
    })
  })
  it('withdraws state without deleting revisions and blocks ineligible students', async () => {
    const { database } = fixture()
    await withdrawCourseworkSubmission(database, id, id, now)
    expect(database.courseworkSubmission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'withdrawn' } }),
    )
    vi.mocked(visibleCourseworkAssignmentForStudent).mockResolvedValue(null)
    await expect(
      submitCourseworkRevision(database, id, id, now),
    ).rejects.toBeInstanceOf(SubmissionRevisionError)
  })
})
