import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import {
  CourseworkLifecycleError,
  publishCourseworkAssignment,
  endCourseworkAssignment,
  changePublishedCourseworkDueDate,
} from './courseworkLifecycle.js'

vi.mock('./courseworkAudience.js', () => ({
  mayManageCourseworkAssignment: vi.fn().mockResolvedValue(true),
}))

const id = '00000000-0000-4000-8000-000000000001'
const dueAt = new Date('2026-12-01T00:00:00.000Z')
function fixture(
  status: 'draft' | 'published' = 'draft',
  fileStatus = 'available',
) {
  const assignment = {
    id,
    schoolId: id,
    status,
    dueAt,
    attachments: [
      {
        fileAsset: {
          status: fileStatus,
          scans: [{ status: 'clean', result: 'clean' }],
        },
      },
    ],
  }
  const transaction = {
    courseworkAssignment: {
      findFirst: vi.fn().mockResolvedValue(assignment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(assignment),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  }
  const database = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}

describe('coursework lifecycle', () => {
  it('blocks publication while any active attachment is not clean', async () => {
    const { database, transaction } = fixture('draft', 'quarantined')
    await expect(
      publishCourseworkAssignment(database, id, id, id, new Date('2026-09-01')),
    ).rejects.toBeInstanceOf(CourseworkLifecycleError)
    expect(transaction.courseworkAssignment.updateMany).not.toHaveBeenCalled()
  })
  it('records publication and permits only controlled close', async () => {
    const { database, transaction } = fixture()
    await publishCourseworkAssignment(
      database,
      id,
      id,
      id,
      new Date('2026-09-01'),
    )
    expect(transaction.courseworkAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      }),
    )
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'coursework.published' }),
      }),
    )
    await expect(
      endCourseworkAssignment(database, id, id, id, 'close'),
    ).rejects.toBeInstanceOf(CourseworkLifecycleError)
  })
  it('preserves previous due date, actor and reason in an audit event', async () => {
    const { database, transaction } = fixture('published')
    await changePublishedCourseworkDueDate(
      database,
      id,
      id,
      id,
      { dueAt: '2026-12-02T00:00:00.000Z', reason: 'School closure' },
      new Date('2026-09-01'),
    )
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: id,
          metadata: expect.objectContaining({
            previousDueAt: dueAt.toISOString(),
            reason: 'School closure',
          }),
        }),
      }),
    )
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(false)
    await expect(
      changePublishedCourseworkDueDate(
        database,
        id,
        id,
        id,
        { dueAt: '2026-12-03T00:00:00.000Z', reason: 'Unauthorized' },
        new Date('2026-09-01'),
      ),
    ).rejects.toBeInstanceOf(CourseworkLifecycleError)
  })
})
