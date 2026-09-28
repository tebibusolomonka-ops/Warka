import { Prisma, type PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  transferCourseworkMark,
  CourseworkMarkTransferError,
} from './courseworkMarkTransfers.js'
import {
  eligibleCourseworkEnrollment,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import { recordMark } from './marks.js'

vi.mock('./courseworkAudience.js', () => ({
  eligibleCourseworkEnrollment: vi.fn(),
  mayManageCourseworkAssignment: vi.fn(),
}))
vi.mock('./marks.js', () => ({ recordMark: vi.fn() }))

const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
function fixture() {
  const assessment = {
    id,
    schoolId: id,
    academicYearId: id,
    gradingPeriodId: id,
    schoolClassId: id,
    subjectId: id,
    maximumScore: new Prisma.Decimal(20),
  }
  const assignment = {
    id,
    schoolId: id,
    academicYearId: id,
    gradingPeriodId: id,
    schoolClassId: id,
    subjectId: id,
    assessment,
    rubric: {
      id,
      criteria: [
        { maxPoints: new Prisma.Decimal(8) },
        { maxPoints: new Prisma.Decimal(12) },
      ],
    },
  }
  const submission = {
    assignmentId: id,
    schoolId: id,
    studentId: id,
    enrollmentId: id,
    status: 'submitted',
  }
  const revision = {
    id,
    submissionId: id,
    submittedAt: new Date(),
    submission,
    review: { status: 'reviewed' },
  }
  const transaction = {
    courseworkAssignment: { findFirst: vi.fn().mockResolvedValue(assignment) },
    submissionRevision: {
      findUnique: vi.fn().mockResolvedValue(revision),
      findFirst: vi.fn().mockResolvedValue({ id }),
    },
    rubricScore: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id, totalPoints: new Prisma.Decimal(15) }),
    },
    mark: { findFirst: vi.fn().mockResolvedValue(null) },
    courseworkMarkTransfer: {
      create: vi.fn().mockResolvedValue({ id, markId: other }),
    },
  }
  const database = {
    $transaction: vi.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  }
  vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(true)
  vi.mocked(eligibleCourseworkEnrollment).mockResolvedValue({ id } as never)
  vi.mocked(recordMark).mockResolvedValue({ id: other } as never)
  return {
    database: database as unknown as PrismaClient,
    transaction,
    assignment,
    revision,
  }
}

describe('explicit coursework mark transfer', () => {
  beforeEach(() => vi.clearAllMocks())
  it('converts a reviewed rubric score and records source provenance once', async () => {
    const { database, transaction } = fixture()
    await transferCourseworkMark(database, id, id, id, id)
    expect(recordMark).toHaveBeenCalledWith(expect.anything(), id, {
      schoolId: id,
      enrollmentId: id,
      assessmentId: id,
      score: '15.00',
    })
    expect(transaction.courseworkMarkTransfer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisionId: id,
        rubricScoreId: id,
        markId: other,
      }),
    })
  })

  it('rejects a previous revision and never calls the mark service', async () => {
    const { database, transaction } = fixture()
    transaction.submissionRevision.findFirst.mockResolvedValue({ id: other })
    await expect(
      transferCourseworkMark(database, id, id, id, id),
    ).rejects.toBeInstanceOf(CourseworkMarkTransferError)
    expect(recordMark).not.toHaveBeenCalled()
  })

  it('does not overwrite an existing official mark', async () => {
    const { database, transaction } = fixture()
    transaction.mark.findFirst.mockResolvedValue({ id: other })
    await expect(
      transferCourseworkMark(database, id, id, id, id),
    ).rejects.toBeInstanceOf(CourseworkMarkTransferError)
    expect(recordMark).not.toHaveBeenCalled()
  })
})
