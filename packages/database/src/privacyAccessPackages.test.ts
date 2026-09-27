import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { generatePrivacyAccessPackage } from './privacyAccessPackages.js'
import { PrivacyPermissionError } from './privacyRequests.js'

const id = '123e4567-e89b-42d3-a456-426614174001'
const schoolId = '123e4567-e89b-42d3-a456-426614174002'
const studentId = '123e4567-e89b-42d3-a456-426614174003'
const requesterId = '123e4567-e89b-42d3-a456-426614174004'
function store() {
  const data = {
    privacyRequest: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id,
          schoolId,
          studentId,
          requesterUserId: requesterId,
          requesterKind: 'student',
          type: 'access',
          status: 'approved',
          school: { organizationId: id },
        }),
      update: vi.fn(),
    },
    user: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            where.id === requesterId
              ? {
                  displayName: 'Student',
                  email: 'student@example.test',
                  passwordHash: 'private',
                }
              : { accountStatus: 'active' },
          ),
        ),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
    },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    student: {
      findFirst: vi.fn().mockResolvedValue({ id: studentId }),
      findUnique: vi
        .fn()
        .mockResolvedValue({
          studentReference: 'WKA-1',
          givenName: 'Hana',
          familyName: 'Bekele',
          dateOfBirth: null,
          passwordHash: 'private',
        }),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
    guardianAccess: { findUnique: vi.fn() },
    studentGuardian: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    publishedResult: { findMany: vi.fn().mockResolvedValue([]) },
    issuedDocument: { findMany: vi.fn().mockResolvedValue([]) },
    auditEvent: { create: vi.fn() },
  }
  return {
    ...data,
    $transaction: vi.fn().mockImplementation((callback) => callback(data)),
  } as unknown as PrismaClient
}

it('selects only requester-scoped fields and omits credentials and unrelated contacts', async () => {
  const database = store()
  const result = await generatePrivacyAccessPackage(database, id, id)
  expect(result.student).toEqual({
    studentReference: 'WKA-1',
    givenName: 'Hana',
    familyName: 'Bekele',
    dateOfBirth: null,
  })
  expect(JSON.stringify(result)).not.toMatch(
    /password|hash|session|otherGuardian/i,
  )
  expect(database.student.findUnique).toHaveBeenCalledWith({
    where: { id: studentId },
    select: {
      studentReference: true,
      givenName: true,
      familyName: true,
      dateOfBirth: true,
    },
  })
  expect(database.privacyRequest.update).toHaveBeenCalledWith({
    where: { id },
    data: { accessPackage: result },
  })
})

it('denies package generation after requester relationship is removed', async () => {
  const database = store()
  vi.mocked(database.studentAccess.findUnique).mockResolvedValue(null)
  await expect(
    generatePrivacyAccessPackage(database, id, id),
  ).rejects.toBeInstanceOf(PrivacyPermissionError)
  expect(database.privacyRequest.update).not.toHaveBeenCalled()
})
