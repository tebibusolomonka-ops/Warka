import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  CreateCourseworkAssignmentSchema,
  CourseworkAssignmentAccessError,
  CourseworkAssignmentContextError,
  createCourseworkAssignment,
} from './courseworkAssignments.js'

const ids = Array.from(
  { length: 7 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
)
const [
  schoolId,
  actorId,
  academicYearId,
  schoolClassId,
  subjectId,
  gradingPeriodId,
  assessmentId,
] = ids as [string, string, string, string, string, string, string]
const input = {
  schoolId,
  academicYearId,
  schoolClassId,
  subjectId,
  gradingPeriodId,
  title: 'Read and respond',
  instructions: 'Write a short response.',
  dueAt: '2026-11-01T12:00:00.000Z',
}

function fixture(assigned = true) {
  const create = vi
    .fn()
    .mockResolvedValue({ status: 'draft', assessmentId: null })
  const database = {
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue({
        role: 'teacher',
        startsAt: new Date('2026-01-01'),
        endsAt: null,
      }),
    },
    teachingAssignment: {
      findFirst: vi.fn().mockResolvedValue(assigned ? { id: actorId } : null),
    },
    gradingPeriod: {
      findFirst: vi.fn().mockResolvedValue({ id: gradingPeriodId }),
    },
    assessment: { findFirst: vi.fn().mockResolvedValue(null) },
    courseworkAssignment: { create },
  } as unknown as PrismaClient
  return { database, create }
}

describe('coursework assignment creation', () => {
  it('rejects HTML instructions and requires an active exact teaching assignment', async () => {
    expect(() =>
      CreateCourseworkAssignmentSchema.parse({
        ...input,
        instructions: '<b>unsafe</b>',
      }),
    ).toThrow()
    const { database, create } = fixture(false)
    await expect(
      createCourseworkAssignment(database, actorId, input),
    ).rejects.toBeInstanceOf(CourseworkAssignmentAccessError)
    expect(create).not.toHaveBeenCalled()
  })
  it('rejects an assessment outside the class and subject context', async () => {
    const { database, create } = fixture()
    await expect(
      createCourseworkAssignment(database, actorId, { ...input, assessmentId }),
    ).rejects.toBeInstanceOf(CourseworkAssignmentContextError)
    expect(create).not.toHaveBeenCalled()
  })
})
