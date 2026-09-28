import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { validateAssessmentSchedule } from './assessmentScheduleValidation.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const date = new Date('2026-10-10T00:00:00.000Z')
const candidate = {
  id,
  schoolId: id,
  academicYearId: id,
  gradingPeriodId: id,
  schoolClassId: id,
  subjectId: id,
  assessmentId: id,
  roomId: id,
  scheduledDate: date,
  startTime: '09:00',
  endTime: '10:00',
}

function fixture(
  options: {
    collisions?: { id: string; schoolClassId: string; roomId: string | null }[]
    capacity?: number | null
    eligibleCount?: number
    roomActive?: boolean
    assessmentExists?: boolean
  } = {},
) {
  const period = {
    startsOn: new Date('2026-09-01T00:00:00.000Z'),
    endsOn: new Date('2026-12-31T00:00:00.000Z'),
  }
  return {
    assessment: {
      findFirst: async () =>
        options.assessmentExists === false ? null : { id },
    },
    academicYear: { findFirst: async () => period },
    gradingPeriod: { findFirst: async () => period },
    assessmentRoom: {
      findFirst: async () => ({
        active: options.roomActive ?? true,
        capacity: options.capacity ?? null,
      }),
    },
    enrollment: { count: async () => options.eligibleCount ?? 10 },
    assessmentSchedule: { findMany: async () => options.collisions ?? [] },
  } as unknown as PrismaClient
}

describe('assessment schedule conflict policy', () => {
  it('allows a non-overlapping valid schedule', async () => {
    expect(await validateAssessmentSchedule(fixture(), candidate)).toEqual([])
  })

  it('reports class and room collisions separately', async () => {
    const issues = await validateAssessmentSchedule(
      fixture({ collisions: [{ id: 'other', schoolClassId: id, roomId: id }] }),
      candidate,
    )
    expect(issues.map((issue) => issue.code)).toEqual([
      'CLASS_COLLISION',
      'ROOM_COLLISION',
    ])
  })

  it('reports insufficient capacity and inactive rooms', async () => {
    expect(
      (
        await validateAssessmentSchedule(fixture({ capacity: 8 }), candidate)
      ).map((issue) => issue.code),
    ).toEqual(['ROOM_CAPACITY'])
    expect(
      (
        await validateAssessmentSchedule(
          fixture({ roomActive: false }),
          candidate,
        )
      ).map((issue) => issue.code),
    ).toEqual(['ROOM_INACTIVE'])
  })

  it('reports mismatched assessment context and invalid dates', async () => {
    expect(
      (
        await validateAssessmentSchedule(
          fixture({ assessmentExists: false }),
          candidate,
        )
      ).map((issue) => issue.code),
    ).toEqual(['ASSESSMENT_CONTEXT'])
    expect(
      (
        await validateAssessmentSchedule(fixture(), {
          ...candidate,
          scheduledDate: new Date('2027-01-01T00:00:00.000Z'),
        })
      ).map((issue) => issue.code),
    ).toEqual(['ACADEMIC_DATE'])
  })
})
