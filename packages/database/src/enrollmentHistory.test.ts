import { describe, expect, it } from 'vitest'
import { RecordEnrollmentHistorySchema } from './enrollmentHistory.js'

const id = '123e4567-e89b-42d3-a456-426614174000'
describe('enrollment history', () => {
  it('accepts explicit lifecycle context and limits reasons', () => {
    expect(
      RecordEnrollmentHistorySchema.parse({
        enrollmentId: id,
        eventType: 'promoted',
        effectiveAt: new Date(),
        previous: { academicYearId: id },
        next: { academicYearId: id },
        reason: 'Reviewed progression',
      }).eventType,
    ).toBe('promoted')
    expect(() =>
      RecordEnrollmentHistorySchema.parse({
        enrollmentId: id,
        eventType: 'read',
        effectiveAt: new Date(),
      }),
    ).toThrow()
    expect(() =>
      RecordEnrollmentHistorySchema.parse({
        enrollmentId: id,
        eventType: 'withdrawn',
        effectiveAt: new Date(),
        reason: 'x'.repeat(501),
      }),
    ).toThrow()
  })
})
