import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createRetentionHold, releaseRetentionHold } from './retentionHolds.js'
import { RetentionPermissionError } from './retentionPolicies.js'

const id = '123e4567-e89b-42d3-a456-426614174001'
const recordId = '123e4567-e89b-42d3-a456-426614174002'
function store() {
  const data = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
    },
    student: { findFirst: vi.fn().mockResolvedValue({ id: recordId }) },
    privacyRequest: { findFirst: vi.fn() },
    issuedDocument: { findFirst: vi.fn() },
    retentionHold: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id,
          organizationId: id,
          scope: 'student',
          releasedAt: null,
        }),
      create: vi.fn().mockResolvedValue({ id }),
      update: vi.fn().mockResolvedValue({ id, releasedAt: new Date() }),
    },
    auditEvent: { create: vi.fn() },
  }
  return {
    ...data,
    $transaction: vi.fn().mockImplementation((callback) => callback(data)),
  } as unknown as PrismaClient
}

it('creates a scoped hold and releases it without deleting records', async () => {
  const database = store()
  await createRetentionHold(database, id, {
    organizationId: id,
    scope: 'student',
    recordId,
    reason: 'Pending records review',
  })
  expect(database.retentionHold.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ studentId: recordId, createdById: id }),
  })
  await releaseRetentionHold(database, id, id)
  expect(database.retentionHold.update).toHaveBeenCalledWith({
    where: { id },
    data: expect.objectContaining({ releasedById: id }),
  })
  expect(database).not.toHaveProperty('student.delete')
})

it('denies a nonadministrator', async () => {
  const database = store()
  vi.mocked(database.organizationMembership.findUnique).mockResolvedValue(null)
  await expect(
    createRetentionHold(database, id, {
      organizationId: id,
      scope: 'student',
      recordId,
      reason: 'Pending records review',
    }),
  ).rejects.toBeInstanceOf(RetentionPermissionError)
})
