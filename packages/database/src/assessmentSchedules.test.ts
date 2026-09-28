import { describe, expect, it } from 'vitest'
import { AssessmentScheduleInputSchema } from './assessmentSchedules.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const input = {
  schoolId: id,
  academicYearId: id,
  gradingPeriodId: id,
  schoolClassId: id,
  subjectId: id,
  assessmentId: id,
  scheduledDate: '2026-10-10',
  startTime: '09:00',
  endTime: '10:00',
}

describe('assessment schedule input', () => {
  it('allows an assessment without a room', () => {
    expect(AssessmentScheduleInputSchema.parse(input)).toEqual(input)
  })

  it('requires increasing valid clock times', () => {
    expect(() =>
      AssessmentScheduleInputSchema.parse({ ...input, endTime: '09:00' }),
    ).toThrow()
    expect(() =>
      AssessmentScheduleInputSchema.parse({ ...input, startTime: '25:00' }),
    ).toThrow()
  })
})
