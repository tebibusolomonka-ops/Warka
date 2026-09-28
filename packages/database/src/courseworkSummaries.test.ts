import { describe, expect, it } from 'vitest'
import { summarizePersonalCoursework } from './courseworkSummaries.js'

describe('factual coursework summaries', () => {
  it('counts assigned, submitted, missing, late, and released feedback without a score', () => {
    expect(
      summarizePersonalCoursework([
        {
          dueAt: '2026-09-01',
          submittedAt: '2026-09-02',
          submissionStatus: 'submitted',
          feedbackAvailable: true,
        },
        {
          dueAt: '2026-09-01',
          submittedAt: null,
          submissionStatus: 'draft',
          feedbackAvailable: false,
        },
        {
          dueAt: '2026-09-03',
          submittedAt: '2026-09-02',
          submissionStatus: 'submitted',
          feedbackAvailable: false,
        },
      ]),
    ).toEqual({
      assigned: 3,
      submitted: 2,
      notSubmitted: 1,
      late: 1,
      feedbackAvailable: 1,
    })
  })
})
