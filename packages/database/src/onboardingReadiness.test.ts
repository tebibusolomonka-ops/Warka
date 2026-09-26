import { describe, expect, it } from 'vitest'
import { summarizeReadiness } from './onboardingReadiness.js'

describe('school readiness', () => {
  it('reports explicit blocked and warning reasons without scoring schools', () => {
    const result = summarizeReadiness([
      {
        key: 'academicYear',
        status: 'blocked',
        reason: 'No academic year is configured',
      },
      {
        key: 'primaryContact',
        status: 'warning',
        reason: 'No primary contact',
      },
    ])
    expect(result.status).toBe('blocked')
    expect(result.checks.map((item) => item.reason)).toContain(
      'No academic year is configured',
    )
    expect(result).not.toHaveProperty('score')
  })
})
