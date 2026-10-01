import { describe, expect, it } from 'vitest'
import { prepareIncidentReview } from './incidentReviews.js'

describe('incident review records', () => {
  it('allows evidence to remain under investigation without changing incident status', () => {
    const result = prepareIncidentReview('investigating', {
      impactSummary: 'API requests were unavailable',
      rootCauseSummary: 'under investigation',
      detectionNotes: 'Readiness alert opened',
      responseNotes: 'Traffic remained stopped',
      followUpActions: [],
    })
    expect(result.incidentStatus).toBe('investigating')
    expect(result.review.rootCauseSummary).toBe('under investigation')
  })

  it('rejects markup in operational review text', () => {
    expect(() =>
      prepareIncidentReview('resolved', {
        impactSummary: '<script>secret</script>',
        rootCauseSummary: 'unknown',
        detectionNotes: 'Alert opened',
        responseNotes: 'Service restored',
        followUpActions: [],
      }),
    ).toThrow()
  })
})
