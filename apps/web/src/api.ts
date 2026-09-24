import {
  ErrorResponseSchema,
  OrganizationsResponseSchema,
  SchoolSchema,
  SchoolsResponseSchema,
  UserIdentitySchema,
  type OrganizationAccess,
  type School,
  type UserIdentity,
} from '@warka/shared'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
  }
}

export function apiBaseUrl(value: string | undefined, origin: string): string {
  if (!value?.trim()) {
    throw new Error('VITE_API_URL is required')
  }

  const url = new URL(value, origin)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.origin !== origin
  ) {
    throw new Error('VITE_API_URL must be a same-origin HTTP URL')
  }

  return url.toString().replace(/\/$/, '')
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
  request: typeof fetch = fetch,
): Promise<unknown> {
  const response = await request(baseUrl + path, {
    ...options,
    credentials: 'include',
  })

  if (response.status === 204) {
    if (!response.ok)
      throw new ApiError('Request failed', response.status, 'REQUEST_FAILED')
    return null
  }

  const body: unknown = await response.json()
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(body)
    throw new ApiError(
      parsed.success ? parsed.data.error.message : 'Request failed',
      response.status,
      parsed.success ? parsed.data.error.code : 'REQUEST_FAILED',
    )
  }
  return body
}

export async function getCurrentUser(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<UserIdentity> {
  return UserIdentitySchema.parse(
    await requestJson(baseUrl, '/auth/me', {}, request),
  )
}

export async function login(
  baseUrl: string,
  email: string,
  password: string,
  request: typeof fetch = fetch,
): Promise<UserIdentity> {
  return UserIdentitySchema.parse(
    await requestJson(
      baseUrl,
      '/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      request,
    ),
  )
}

export async function logout(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<void> {
  await requestJson(baseUrl, '/auth/logout', { method: 'POST' }, request)
}

export async function getOrganizations(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<OrganizationAccess[]> {
  return OrganizationsResponseSchema.parse(
    await requestJson(baseUrl, '/organizations', {}, request),
  )
}

export async function getSchools(
  baseUrl: string,
  organizationId: string,
  request: typeof fetch = fetch,
): Promise<School[]> {
  return SchoolsResponseSchema.parse(
    await requestJson(
      baseUrl,
      '/organizations/' + encodeURIComponent(organizationId) + '/schools',
      {},
      request,
    ),
  )
}

export async function postSchool(
  baseUrl: string,
  organizationId: string,
  name: string,
  request: typeof fetch = fetch,
): Promise<School> {
  return SchoolSchema.parse(
    await requestJson(
      baseUrl,
      '/organizations/' + encodeURIComponent(organizationId) + '/schools',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      },
      request,
    ),
  )
}
