export type RuntimeProfile = 'development' | 'release-candidate' | 'production'

export function releaseCandidateConfig(profile: RuntimeProfile) {
  if (profile === 'production') {
    return {
      security: 'strict',
      cache: 'private',
      providers: 'real',
      isolated: false,
    } as const
  }
  if (profile === 'release-candidate') {
    return {
      security: 'strict',
      cache: 'private',
      providers: 'deterministic-test',
      isolated: true,
    } as const
  }
  return {
    security: 'development',
    cache: 'disabled',
    providers: 'local',
    isolated: true,
  } as const
}

export function validateProfile(
  profile: RuntimeProfile,
  requestedProviders: string,
) {
  if (profile === 'production' && requestedProviders !== 'real') {
    throw new Error('Production requires real providers')
  }
  return releaseCandidateConfig(profile)
}
