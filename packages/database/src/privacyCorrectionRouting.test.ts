import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { routePrivacyCorrection } from './privacyCorrectionRouting.js'
import { PrivacyPermissionError } from './privacyRequests.js'

const id = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const schoolId = '123e4567-e89b-42d3-a456-426614174003'
function store() {
  const data = {
    privacyRequest: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id,
          schoolId,
          studentId,
          requesterUserId: id,
          requesterKind: 'student',
          type: 'correction',
          status: 'approved',
          correctionField: 'givenName',
          correctionValue: 'Hanna',
          details: 'Correct spelling',
          officialCorrectionRequestId: null,
        }),
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
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
    guardianAccess: { findUnique: vi.fn() },
    studentGuardian: { findFirst: vi.fn() },
    student: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          givenName: 'Hana',
          familyName: null,
          dateOfBirth: null,
        }),
    },
    studentCorrectionRequest: {
      create: vi.fn().mockResolvedValue({ id }),
      findUniqueOrThrow: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  }
  return {
    ...data,
    $transaction: vi.fn().mockImplementation((callback) => callback(data)),
  } as unknown as PrismaClient
}

it('routes approved privacy correction into official approval without mutating the student', async () => {
  const database = store()
  await routePrivacyCorrection(database, id, id)
  expect(database.studentCorrectionRequest.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      previousValue: 'Hana',
      proposedValue: 'Hanna',
    }),
  })
  expect(database.privacyRequest.update).toHaveBeenCalledWith({
    where: { id },
    data: { officialCorrectionRequestId: id },
  })
  expect(database.student).not.toHaveProperty('update')
})

it('denies a reviewer outside the request school', async () => {
  const database = store()
  vi.mocked(database.organizationMembership.findUnique).mockResolvedValue(null)
  await expect(routePrivacyCorrection(database, id, id)).rejects.toBeInstanceOf(
    PrivacyPermissionError,
  )
  expect(database.studentCorrectionRequest.create).not.toHaveBeenCalled()
})
