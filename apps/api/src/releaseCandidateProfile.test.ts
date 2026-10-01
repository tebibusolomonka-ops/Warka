import { describe, expect, it } from 'vitest'

import {
  releaseCandidateConfig,
  validateProfile,
} from './releaseCandidateProfile.js'

describe('release candidate profile', () => {
  it('uses strict security and isolated deterministic providers', () => {
    expect(releaseCandidateConfig('release-candidate')).toEqual({
      security: 'strict',
      cache: 'private',
      providers: 'deterministic-test',
      isolated: true,
    })
  })

  it('cannot select fake providers in production', () => {
    expect(() => validateProfile('production', 'deterministic-test')).toThrow(
      'Production requires real providers',
    )
  })
})
