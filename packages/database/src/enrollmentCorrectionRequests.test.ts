import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createEnrollmentCorrectionRequest,
  EnrollmentCorrectionInputSchema,
  EnrollmentCorrectionPermissionError,
  EnrollmentCorrectionStateError,
} from './enrollmentCorrectionRequests.js'

describe('enrollment placement correction requests', () => {
  it('rejects unrelated placement operations and mismatched classes', async () => {
    expect(
      EnrollmentCorrectionInputSchema.safeParse({
        proposedGradeLevelId: randomUUID(),
        proposedSchoolClassId: null,
        reason: 'Correction',
        newSchoolId: randomUUID(),
      }).success,
    ).toBe(false)
    const actorId = randomUUID(),
      schoolId = randomUUID(),
      enrollmentId = randomUUID()
    const gradeId = randomUUID(),
      classId = randomUUID(),
      yearId = randomUUID()
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
      enrollment: {
        findFirst: vi.fn().mockResolvedValue({
          academicYearId: yearId,
          gradeLevelId: randomUUID(),
          schoolClassId: null,
        }),
        update: vi.fn(),
      },
      gradeLevel: { findFirst: vi.fn().mockResolvedValue({ id: gradeId }) },
      schoolClass: { findFirst: vi.fn().mockResolvedValue(null) },
      enrollmentCorrectionRequest: {
        create: vi.fn().mockImplementation(async ({ data }) => data),
      },
    } as unknown as PrismaClient
    const input = {
      proposedGradeLevelId: gradeId,
      proposedSchoolClassId: classId,
      reason: 'Incorrect placement',
    }
    await expect(
      createEnrollmentCorrectionRequest(
        database,
        actorId,
        schoolId,
        enrollmentId,
        input,
      ),
    ).rejects.toBeInstanceOf(EnrollmentCorrectionStateError)
    vi.mocked(database.schoolClass.findFirst).mockResolvedValueOnce({
      id: classId,
    } as never)
    const request = await createEnrollmentCorrectionRequest(
      database,
      actorId,
      schoolId,
      enrollmentId,
      input,
    )
    expect(request).toMatchObject({
      previousSchoolClassId: null,
      proposedSchoolClassId: classId,
      academicYearId: yearId,
    })
    expect(database.schoolClass.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId,
          academicYearId: yearId,
          gradeLevelId: gradeId,
        }),
      }),
    )
    expect(database.enrollment.update).not.toHaveBeenCalled()
    vi.mocked(database.schoolMembership.findUnique).mockResolvedValueOnce({
      role: 'teacher',
      startsAt: new Date(0),
      endsAt: null,
    } as never)
    await expect(
      createEnrollmentCorrectionRequest(
        database,
        actorId,
        schoolId,
        enrollmentId,
        input,
      ),
    ).rejects.toBeInstanceOf(EnrollmentCorrectionPermissionError)
  })
})
