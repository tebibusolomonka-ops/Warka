import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { visibleCourseworkAssignmentForStudent } from './courseworkAudience.js'
import {
  saveDraftSubmissionRevision,
  submitCourseworkRevision,
  SubmissionRevisionError,
  SubmissionTextSchema,
  withdrawCourseworkSubmission,
  listOwnSubmissionRevisions,
} from './submissionRevisions.js'

vi.mock('./courseworkAudience.js', () => ({
  visibleCourseworkAssignmentForStudent: vi.fn(),
}))
vi.mock('./courseworkNotifications.js', () => ({
  notifyCoursework: vi.fn().mockResolvedValue({ count: 0 }),
}))
vi.mock('./assignmentExtensions.js', () => ({
  effectiveCourseworkDueAt: vi.fn().mockResolvedValue(new Date('2026-12-01')),
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
    courseworkAssignment: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ createdById: id }),
    },
    courseworkSubmission: {
      findUnique: vi.fn().mockResolvedValue({ id, status: 'submitted' }),
      update: vi.fn().mockResolvedValue({}),
    },
    submissionRevision: {
      findFirst: vi.fn().mockResolvedValue(latest),
      create: vi.fn().mockResolvedValue({
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id }),
    },
    submissionReview: { create: vi.fn().mockResolvedValue({}) },
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
      assignment: { status: 'published', dueAt: new Date('2026-12-01') },
    } as never)
})
describe('submission revisions', () => {
  it('keeps draft feedback and rubric scores private until release', async () => {
    const row = {
      id,
      revisionNumber: 1,
      textResponse: 'Answer',
      submittedAt: now,
      attachments: [],
      feedback: {
        status: 'draft',
        text: 'Private draft',
        releasedAt: null as Date | null,
      },
      rubricScores: [
        {
          totalPoints: { toString: () => '8' },
          criteria: [
            {
              points: { toString: () => '8' },
              criterion: {
                title: 'Clarity',
                maxPoints: { toString: () => '10' },
              },
            },
          ],
        },
      ],
    }
    const database = {
      courseworkSubmission: { findUnique: vi.fn().mockResolvedValue({ id }) },
      submissionRevision: { findMany: vi.fn().mockResolvedValue([row]) },
    } as unknown as PrismaClient
    const hidden = await listOwnSubmissionRevisions(database, id, id)
    expect(hidden[0]).toMatchObject({ feedback: null, rubricScore: null })
    row.feedback = {
      status: 'released',
      text: 'Helpful feedback',
      releasedAt: now,
    }
    const visible = await listOwnSubmissionRevisions(database, id, id)
    expect(visible[0]).toMatchObject({
      feedback: { text: 'Helpful feedback' },
      rubricScore: { totalPoints: '8' },
    })
  })
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
