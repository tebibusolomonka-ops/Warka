import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  reviewPrivacyRequest,
  fulfillPrivacyAccessRequest,
} from './privacyReview.js'
import { PrivacyPermissionError } from './privacyRequests.js'
import { routePrivacyCorrection } from './privacyCorrectionRouting.js'
import { generatePrivacyAccessPackage } from './privacyAccessPackages.js'

vi.mock('./privacyCorrectionRouting.js', () => ({
  routePrivacyCorrection: vi.fn(),
}))
vi.mock('./privacyAccessPackages.js', () => ({
  generatePrivacyAccessPackage: vi.fn(),
}))
vi.mock('./processingRestrictions.js', () => ({
  applyProcessingRestriction: vi.fn(),
}))
const id = '123e4567-e89b-42d3-a456-426614174001'
const schoolId = '123e4567-e89b-42d3-a456-426614174002'
const requesterId = '123e4567-e89b-42d3-a456-426614174003'
function store(type: 'access' | 'correction' = 'correction') {
  const request = {
    id,
    schoolId,
    requesterUserId: requesterId,
    type,
    status: 'submitted',
    accessPackage: { student: {} },
  }
  const data = {
    notification: { create: vi.fn() },
    privacyRequest: {
      findUnique: vi.fn().mockResolvedValue(request),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ ...request, status: 'approved' }),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...request, ...data }),
        ),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: id }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: id }),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
    },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    auditEvent: { create: vi.fn() },
  }
  return {
    ...data,
    $transaction: vi.fn().mockImplementation((callback) => callback(data)),
  } as unknown as PrismaClient
}

it('routes approved corrections without directly updating official identity', async () => {
  const database = store()
  await reviewPrivacyRequest(database, id, id, 'approve')
  expect(routePrivacyCorrection).toHaveBeenCalledWith(database, id, id)
  expect(database.privacyRequest.update).toHaveBeenCalledWith({
    where: { id },
    data: expect.objectContaining({ status: 'approved' }),
  })
  expect(database).not.toHaveProperty('student.update')
})

it('denies teacher review and self-approval', async () => {
  const database = store()
  vi.mocked(database.organizationMembership.findUnique).mockResolvedValue(null)
  await expect(
    reviewPrivacyRequest(database, id, id, 'approve'),
  ).rejects.toBeInstanceOf(PrivacyPermissionError)
  vi.mocked(database.organizationMembership.findUnique).mockResolvedValue({
    role: 'administrator',
  } as never)
  await expect(
    reviewPrivacyRequest(database, requesterId, id, 'approve'),
  ).rejects.toBeInstanceOf(PrivacyPermissionError)
})

it('fulfills only approved access requests after package generation', async () => {
  const database = store('access')
  vi.mocked(database.privacyRequest.findUnique).mockResolvedValue({
    id,
    schoolId,
    requesterUserId: requesterId,
    type: 'access',
    status: 'approved',
  } as never)
  await fulfillPrivacyAccessRequest(database, id, id)
  expect(generatePrivacyAccessPackage).toHaveBeenCalledWith(database, id, id)
  expect(database.privacyRequest.update).toHaveBeenCalledWith({
    where: { id },
    data: expect.objectContaining({ status: 'fulfilled' }),
  })
})
