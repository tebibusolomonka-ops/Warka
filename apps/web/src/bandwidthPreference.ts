export type BandwidthPreference = 'standard' | 'lowBandwidth'
export const suggestedLowBandwidth = (effectiveType?: string) =>
  ['slow-2g', '2g'].includes(effectiveType ?? '')
export async function saveBandwidthPreference(
  baseUrl: string,
  bandwidthPreference: BandwidthPreference,
) {
  const response = await fetch(`${baseUrl}/me/bandwidth-preference`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bandwidthPreference }),
  })
  if (!response.ok) throw new Error('Could not save bandwidth preference')
  return (await response.json()) as { bandwidthPreference: BandwidthPreference }
}
