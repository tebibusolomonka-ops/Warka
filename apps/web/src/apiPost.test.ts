import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareReport } from './bureauApi'
import { completeReview } from './governanceApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('empty JSON actions', () => {
  it('does not label a bodyless Bureau preview as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await prepareReport('https://api.example', 'school-id', 'period-id')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/schools/school-id/reporting/period-id/prepare',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('headers')
  })

  it('does not label a bodyless review completion as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await completeReview('https://api.example', 'organization-id', 'review-id')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/governance/organization-id/reviews/review-id/complete',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('headers')
  })
})
