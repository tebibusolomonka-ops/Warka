import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  applyProcessingRestriction,
  isParentPortalSharingRestricted,
} from './processingRestrictions.js'

const id = '123e4567-e89b-42d3-a456-426614174001'
const schoolId = '123e4567-e89b-42d3-a456-426614174002'
const studentId = '123e4567-e89b-42d3-a456-426614174003'
function store(category: 'parentPortalSharing' | 'publicDocumentVerification') {
  const data = {
    notification: { create: vi.fn() },
    privacyRequest: {
      findUnique: vi.fn().mockResolvedValue({
        id,
        schoolId,
        studentId,
        requesterUserId: id,
        type: 'restriction',
        status: 'approved',
        restrictionCategory: category,
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    school: { findUnique: vi.fn().mockResolvedValue({ organizationId: id }) },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
    },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    processingRestriction: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id, ...data })),
    },
    auditEvent: { create: vi.fn() },
  }
  return {
    ...data,
    $transaction: vi.fn().mockImplementation((callback) => callback(data)),
  } as unknown as PrismaClient
}

it('activates parent portal sharing restriction and makes server lookup deny sharing', async () => {
  const database = store('parentPortalSharing')
  const result = await applyProcessingRestriction(database, id, id)
  expect(result.status).toBe('active')
  expect(database.processingRestriction.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      category: 'parentPortalSharing',
      status: 'active',
    }),
  })
  vi.mocked(database.processingRestriction.findFirst).mockResolvedValue({
    id,
  } as never)
  expect(
    await isParentPortalSharingRestricted(database, schoolId, studentId),
  ).toBe(true)
})

it('leaves public document verification in explicit manual review', async () => {
  const database = store('publicDocumentVerification')
  const result = await applyProcessingRestriction(database, id, id)
  expect(result.status).toBe('reviewRequired')
  expect(result.effectiveAt).toBeNull()
})
