import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createPrivacyRequest,
  PrivacyPermissionError,
  PrivacyRequestInputSchema,
} from './privacyRequests.js'

const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const userId = '123e4567-e89b-42d3-a456-426614174003'
const input = {
  schoolId,
  studentId,
  type: 'access',
  details: 'Please prepare my records',
}
function store() {
  return {
    student: { findFirst: vi.fn().mockResolvedValue({ id: studentId }) },
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
    guardianAccess: { findUnique: vi.fn() },
    studentGuardian: { findFirst: vi.fn() },
    privacyRequest: { create: vi.fn().mockResolvedValue({ id: 'request' }) },
    notification: { create: vi.fn() },
  } as unknown as PrismaClient
}

describe('privacy request records', () => {
  it('uses the authenticated student relationship and does not accept arbitrary fields', async () => {
    const database = store()
    await createPrivacyRequest(database, userId, input)
    expect(database.privacyRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterUserId: userId,
        requesterKind: 'student',
        studentId,
      }),
    })
    expect(
      PrivacyRequestInputSchema.safeParse({ ...input, requesterUserId: userId })
        .success,
    ).toBe(false)
  })
  it('denies unrelated students and guardians', async () => {
    const database = store()
    vi.mocked(database.studentAccess.findUnique).mockResolvedValue(null)
    vi.mocked(database.guardianAccess.findUnique).mockResolvedValue({
      guardianId: userId,
    } as never)
    vi.mocked(database.studentGuardian.findFirst).mockResolvedValue(null)
    await expect(
      createPrivacyRequest(database, userId, input),
    ).rejects.toBeInstanceOf(PrivacyPermissionError)
    expect(database.privacyRequest.create).not.toHaveBeenCalled()
  })
  it('requires a verified guardian relationship in the same school', async () => {
    const database = store()
    vi.mocked(database.studentAccess.findUnique).mockResolvedValue(null)
    vi.mocked(database.guardianAccess.findUnique).mockResolvedValue({
      guardianId: userId,
    } as never)
    vi.mocked(database.studentGuardian.findFirst).mockResolvedValue({
      studentId,
    } as never)
    await createPrivacyRequest(database, userId, input)
    expect(database.studentGuardian.findFirst).toHaveBeenCalledWith({
      where: {
        studentId,
        guardianId: userId,
        verificationStatus: 'verified',
        verificationSchoolId: schoolId,
        revokedAt: null,
      },
      select: { studentId: true },
    })
    expect(database.privacyRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requesterKind: 'guardian' }),
    })
  })
})
