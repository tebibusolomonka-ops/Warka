import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { notifyPrivacyRequester } from './privacyNotifications.js'
import { reviewPrivacyRequest } from './privacyReview.js'

const id = '123e4567-e89b-42d3-a456-426614174001'
const requesterId = '123e4567-e89b-42d3-a456-426614174002'
const schoolId = '123e4567-e89b-42d3-a456-426614174003'

it('uses neutral notification text linked only to the request', async () => {
  const database = {
    notification: { create: vi.fn() },
  } as unknown as PrismaClient
  await notifyPrivacyRequester(database, requesterId, id, 'fulfilled')
  expect(database.notification.create).toHaveBeenCalledWith({
    data: {
      userId: requesterId,
      type: 'privacy.fulfilled',
      title: 'Access package ready',
      message: expect.not.stringMatching(/student|correction value|password/i),
      resourceType: 'privacyRequest',
      resourceId: id,
    },
  })
})

it('does not duplicate notifications on approved-request retry', async () => {
  const request = {
    id,
    schoolId,
    requesterUserId: requesterId,
    type: 'access',
    status: 'approved',
  }
  const data = {
    privacyRequest: {
      findUnique: vi.fn().mockResolvedValue(request),
      findUniqueOrThrow: vi.fn().mockResolvedValue(request),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    school: { findUnique: vi.fn().mockResolvedValue({ organizationId: id }) },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
    },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    notification: { create: vi.fn() },
  }
  const database = {
    ...data,
    $transaction: vi.fn().mockImplementation((callback) => callback(data)),
  } as unknown as PrismaClient
  await reviewPrivacyRequest(database, id, id, 'approve')
  expect(database.notification.create).not.toHaveBeenCalled()
})
