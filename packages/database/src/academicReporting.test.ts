import { describe, expect, it } from 'vitest'
import { summarizeAcademicOutcomes } from './academicReporting.js'

describe('academic outcome aggregates', () => {
  it('uses official grade labels without inventing pass semantics', () => {
    expect(summarizeAcademicOutcomes([]).publishedResultCount).toBe(0)
    expect(
      summarizeAcademicOutcomes([
        { currentGradeLabel: 'Meets standard' },
        { currentGradeLabel: 'Meets standard' },
        { currentGradeLabel: 'Developing' },
      ]).outcomes,
    ).toEqual([
      { gradeLabel: 'Developing', count: 1 },
      { gradeLabel: 'Meets standard', count: 2 },
    ])
  })
})
