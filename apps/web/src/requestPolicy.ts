import type { BandwidthPreference } from './bandwidthPreference'

export type RequestPolicy = {
  pageSize: number
  automaticSecondaryRefresh: boolean
  preloadLargePreviews: boolean
  refreshIntervalMs: number | null
}
export function requestPolicy(preference: BandwidthPreference): RequestPolicy {
  return preference === 'lowBandwidth'
    ? {
        pageSize: 20,
        automaticSecondaryRefresh: false,
        preloadLargePreviews: false,
        refreshIntervalMs: null,
      }
    : {
        pageSize: 50,
        automaticSecondaryRefresh: true,
        preloadLargePreviews: true,
        refreshIntervalMs: 60_000,
      }
}
export function criticalMutationAllowed(_preference: BandwidthPreference) {
  return true
}
