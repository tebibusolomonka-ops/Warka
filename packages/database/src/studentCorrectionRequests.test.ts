import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createStudentCorrectionRequest,
  StudentCorrectionInputSchema,
  StudentCorrectionPermissionError,
} from './studentCorrectionRequests.js'

describe('student identity correction requests', () => {
  it('allows only explicit identity fields', () => {
    expect(
      StudentCorrectionInputSchema.safeParse({
        field: 'email',
        proposedValue: 'x',
        reason: 'Typo',
      }).success,
    ).toBe(false)
    expect(
      StudentCorrectionInputSchema.safeParse({
        field: 'dateOfBirth',
        proposedValue: 'not-a-date',
        reason: 'Typo',
      }).success,
    ).toBe(false)
    expect(
      StudentCorrectionInputSchema.safeParse({
        field: 'givenName',
        proposedValue: null,
        reason: 'Typo',
      }).success,
    ).toBe(false)
  })

  it('keeps previous official values without modifying the student', async () => {
    const actorId = randomUUID(),
      schoolId = randomUUID(),
      studentId = randomUUID()
    const database = {
      school: {
        findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
      },
      organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
      schoolMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: 'registrar',
          startsAt: new Date(0),
          endsAt: null,
        }),
      },
      student: {
        findFirst: vi.fn().mockResolvedValue({
          givenName: 'Old',
          familyName: 'Name',
          dateOfBirth: null,
        }),
        update: vi.fn(),
      },
      studentCorrectionRequest: {
        create: vi.fn().mockImplementation(async ({ data }) => data),
      },
    } as unknown as PrismaClient
    const request = await createStudentCorrectionRequest(
      database,
      actorId,
      schoolId,
      studentId,
      {
        field: 'givenName',
        proposedValue: 'New',
        reason: 'Documented spelling correction',
      },
    )
    expect(request).toMatchObject({
      previousValue: 'Old',
      proposedValue: 'New',
    })
    expect(database.student.update).not.toHaveBeenCalled()
    vi.mocked(database.schoolMembership.findUnique).mockResolvedValueOnce(null)
    await expect(
      createStudentCorrectionRequest(database, actorId, schoolId, studentId, {
        field: 'givenName',
        proposedValue: 'New',
        reason: 'Documented spelling correction',
      }),
    ).rejects.toBeInstanceOf(StudentCorrectionPermissionError)
  })
})
