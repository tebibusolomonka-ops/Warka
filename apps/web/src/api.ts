import {
  ErrorResponseSchema,
  HealthResponseSchema,
  OrganizationSchema,
  SchoolSchema,
  SchoolsResponseSchema,
  type HealthResponse,
  type Organization,
  type School,
} from '@warka/shared'

export function apiBaseUrl(value: string | undefined, origin: string): string {
  if (!value?.trim()) {
    throw new Error('VITE_API_URL is required')
  }

  const url = new URL(value, origin)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('VITE_API_URL must be an HTTP URL without credentials')
  }

  return url.toString().replace(/\/$/, '')
}

async function responseJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json()
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(body)
    throw new Error(
      parsed.success ? parsed.data.error.message : 'Request failed',
    )
  }
  return body
}

export async function getHealth(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<HealthResponse> {
  const response = await request(`${baseUrl}/health`)
  return HealthResponseSchema.parse(await responseJson(response))
}

export async function getSchools(
  baseUrl: string,
  organizationId: string,
  request: typeof fetch = fetch,
): Promise<School[]> {
  const response = await request(
    `${baseUrl}/organizations/${organizationId}/schools`,
  )
  return SchoolsResponseSchema.parse(await responseJson(response))
}

export async function postOrganization(
  baseUrl: string,
  name: string,
  request: typeof fetch = fetch,
): Promise<Organization> {
  const response = await request(`${baseUrl}/organizations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return OrganizationSchema.parse(await responseJson(response))
}

export async function postSchool(
  baseUrl: string,
  organizationId: string,
  name: string,
  request: typeof fetch = fetch,
): Promise<School> {
  const response = await request(
    `${baseUrl}/organizations/${organizationId}/schools`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  )
  return SchoolSchema.parse(await responseJson(response))
}
