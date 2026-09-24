import { HealthResponseSchema, type HealthResponse } from '@warka/shared'

export function apiBaseUrl(value: string | undefined, origin: string): string {
  if (!value?.trim()) {
    throw new Error('VITE_API_URL is required')
  }

  const url = new URL(value, origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('VITE_API_URL must be an HTTP URL without credentials')
  }

  return url.toString().replace(/\/$/, '')
}

export async function getHealth(baseUrl: string, request: typeof fetch = fetch): Promise<HealthResponse> {
  const response = await request(`${baseUrl}/health`)
  if (!response.ok) {
    throw new Error('Service health request failed')
  }

  return HealthResponseSchema.parse(await response.json())
}
