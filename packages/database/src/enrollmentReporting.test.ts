import { describe, expect, it } from 'vitest'
import { summarizeEnrollmentRows } from './enrollmentReporting.js'

describe('enrollment reporting aggregates', () => {
  it('preserves legitimate zero and groups official rows', () => {
    expect(summarizeEnrollmentRows([])).toEqual({
      dataState: 'reported',
      total: 0,
      byAcademicYear: [],
      byGradeLevel: [],
    })
    const aggregate = summarizeEnrollmentRows([
      {
        academicYear: { id: 'year', name: '2026' },
        gradeLevel: { id: 'grade', name: 'Grade 7' },
      },
      {
        academicYear: { id: 'year', name: '2026' },
        gradeLevel: { id: 'grade', name: 'Grade 7' },
      },
    ])
    expect(aggregate.total).toBe(2)
    expect(aggregate.byGradeLevel[0]?.count).toBe(2)
  })
})
