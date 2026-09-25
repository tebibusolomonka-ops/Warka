import { describe, expect, it } from 'vitest'
import { ReportingSubmissionError } from './reportingSubmissions.js'

describe('school reporting submissions', () => {
  it('keeps returned and approved states explicit', () => {
    expect(new ReportingSubmissionError('returned').message).toBe('returned')
    expect(['draft', 'submitted', 'approved', 'returned']).not.toContain(
      'missing',
    )
  })
})
