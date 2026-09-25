import {
  AccessibleSchoolsResponseSchema,
  EnrollmentSchema,
  ErrorResponseSchema,
  OrganizationsResponseSchema,
  RegisterStudentSchema,
  RegistrationResponseSchema,
  SchoolSchema,
  SchoolsResponseSchema,
  StudentDetailResponseSchema,
  StudentListResponseSchema,
  StudentOptionsSchema,
  StudentPortalIdentitySchema,
  StudentResultsSchema,
  StudentMaterialsSchema,
  StudentAnnouncementsSchema,
  StudentAccountStatusSchema,
  UserIdentitySchema,
  type AccessibleSchool,
  type OrganizationAccess,
  type RegisterStudent,
  type RegistrationResponse,
  type School,
  type StudentDetailResponse,
  type StudentListResponse,
  type StudentOptions,
  type StudentPortalIdentity,
  type StudentResult,
  type StudentMaterial,
  type StudentAnnouncement,
  type StudentAccountStatus,
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

export async function requestJson(
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

export async function getAccessibleSchools(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<AccessibleSchool[]> {
  return AccessibleSchoolsResponseSchema.parse(
    await requestJson(baseUrl, '/schools', {}, request),
  )
}

function studentPath(schoolId: string): string {
  return '/schools/' + encodeURIComponent(schoolId) + '/students'
}

export async function getStudentOptions(
  baseUrl: string,
  schoolId: string,
  request: typeof fetch = fetch,
): Promise<StudentOptions> {
  return StudentOptionsSchema.parse(
    await requestJson(
      baseUrl,
      '/schools/' + encodeURIComponent(schoolId) + '/student-options',
      {},
      request,
    ),
  )
}

export async function getStudents(
  baseUrl: string,
  schoolId: string,
  offset = 0,
  request: typeof fetch = fetch,
): Promise<StudentListResponse> {
  return StudentListResponseSchema.parse(
    await requestJson(
      baseUrl,
      studentPath(schoolId) + '?limit=50&offset=' + offset,
      {},
      request,
    ),
  )
}

export async function getStudentDetail(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  request: typeof fetch = fetch,
): Promise<StudentDetailResponse> {
  return StudentDetailResponseSchema.parse(
    await requestJson(
      baseUrl,
      studentPath(schoolId) + '/' + encodeURIComponent(studentId),
      {},
      request,
    ),
  )
}

export async function registerStudent(
  baseUrl: string,
  schoolId: string,
  input: RegisterStudent,
  request: typeof fetch = fetch,
): Promise<RegistrationResponse> {
  return RegistrationResponseSchema.parse(
    await requestJson(
      baseUrl,
      studentPath(schoolId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(RegisterStudentSchema.parse(input)),
      },
      request,
    ),
  )
}

export async function actOnEnrollment(
  baseUrl: string,
  schoolId: string,
  enrollmentId: string,
  action: 'submit' | 'approve',
  request: typeof fetch = fetch,
) {
  return EnrollmentSchema.parse(
    await requestJson(
      baseUrl,
      '/schools/' +
        encodeURIComponent(schoolId) +
        '/enrollments/' +
        encodeURIComponent(enrollmentId) +
        '/' +
        action,
      { method: 'POST' },
      request,
    ),
  )
}

export async function changePassword(
  baseUrl: string,
  currentPassword: string,
  newPassword: string,
  request: typeof fetch = fetch,
): Promise<void> {
  await requestJson(
    baseUrl,
    '/auth/change-password',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    request,
  )
}

export async function getStudentIdentity(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<StudentPortalIdentity> {
  return StudentPortalIdentitySchema.parse(
    await requestJson(baseUrl, '/student/me', {}, request),
  )
}

export async function getStudentResults(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<StudentResult[]> {
  return StudentResultsSchema.parse(
    await requestJson(baseUrl, '/student/results', {}, request),
  )
}

export async function getStudentMaterials(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<StudentMaterial[]> {
  return StudentMaterialsSchema.parse(
    await requestJson(baseUrl, '/student/materials', {}, request),
  )
}

export async function getStudentAnnouncements(
  baseUrl: string,
  request: typeof fetch = fetch,
): Promise<StudentAnnouncement[]> {
  return StudentAnnouncementsSchema.parse(
    await requestJson(baseUrl, '/student/announcements', {}, request),
  )
}

export async function getStudentAccountStatus(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  request: typeof fetch = fetch,
): Promise<StudentAccountStatus> {
  return StudentAccountStatusSchema.parse(
    await requestJson(
      baseUrl,
      studentPath(schoolId) + '/' + encodeURIComponent(studentId) + '/access',
      {},
      request,
    ),
  )
}

export async function provisionStudentAccount(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  input: { email: string; displayName: string; initialPassword: string },
  request: typeof fetch = fetch,
): Promise<void> {
  await requestJson(
    baseUrl,
    studentPath(schoolId) + '/' + encodeURIComponent(studentId) + '/access',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
    request,
  )
}
