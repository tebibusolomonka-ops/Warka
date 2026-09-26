import { ApiError } from './api'

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(baseUrl + path, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json()) as T & {
    error?: { code: string; message: string }
  }
  if (!response.ok)
    throw new ApiError(
      body.error?.message ?? 'Request failed',
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
    )
  return body
}

export type BureauAccess = {
  organizationId: string
  role: 'viewer' | 'reportManager'
  organization: { id: string; name: string }
}
export type ReportingPeriod = {
  id: string
  name: string
  status: 'draft' | 'open' | 'closed'
  startsOn: string
  endsOn: string
  submissionDueOn: string
  requirements: Array<{ school: { id: string; name: string } }>
}
export type Submission = {
  id: string
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  snapshot: Record<string, unknown>
  submittedAt?: string
  approvedAt?: string
  returnReason?: string
  school: { id: string; name: string }
  reportingPeriod: { id: string; name: string }
}

export const getBureauAccess = (baseUrl: string) =>
  request<BureauAccess[]>(baseUrl, '/bureau/access')
export const listPeriods = (baseUrl: string, organizationId: string) =>
  request<ReportingPeriod[]>(baseUrl, `/bureau/${organizationId}/periods`)
export const listSubmissions = (baseUrl: string, organizationId: string) =>
  request<Submission[]>(baseUrl, `/bureau/${organizationId}/submissions`)
export const getCoverage = (
  baseUrl: string,
  organizationId: string,
  periodId: string,
) =>
  request<{
    coverage: {
      expected: number
      draft: number
      submitted: number
      approved: number
      returned: number
      missing: number
    }
    schools: Array<{ school: { name: string }; freshness: string }>
  }>(baseUrl, `/bureau/${organizationId}/periods/${periodId}/coverage`)
export const createPeriod = (
  baseUrl: string,
  organizationId: string,
  body: object,
) =>
  request<ReportingPeriod>(baseUrl, `/bureau/${organizationId}/periods`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
export const changePeriod = (
  baseUrl: string,
  organizationId: string,
  periodId: string,
  action: 'open' | 'close',
) =>
  request<ReportingPeriod>(
    baseUrl,
    `/bureau/${organizationId}/periods/${periodId}/${action}`,
    { method: 'POST' },
  )
export const decideSubmission = (
  baseUrl: string,
  organizationId: string,
  id: string,
  action: 'approve' | 'return',
  reason?: string,
) =>
  request<Submission>(
    baseUrl,
    `/bureau/${organizationId}/submissions/${id}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify(action === 'return' ? { reason } : {}),
    },
  )
export const prepareReport = (
  baseUrl: string,
  schoolId: string,
  periodId: string,
) =>
  request<Submission>(
    baseUrl,
    `/schools/${schoolId}/reporting/${periodId}/prepare`,
    { method: 'POST' },
  )
export const submitReport = (
  baseUrl: string,
  schoolId: string,
  periodId: string,
) =>
  request<Submission>(
    baseUrl,
    `/schools/${schoolId}/reporting/${periodId}/submit`,
    { method: 'POST' },
  )

export type SchoolReport = {
  reportingPeriodId: string
  reportingPeriod: ReportingPeriod
  school: { id: string; name: string }
  submission: Submission | null
}

export const listSchoolReports = (baseUrl: string, schoolId: string) =>
  request<SchoolReport[]>(baseUrl, `/schools/${schoolId}/reporting`)

export type BureauSchool = { id: string; name: string }
export const listBureauSchools = (baseUrl: string, organizationId: string) =>
  request<BureauSchool[]>(baseUrl, `/bureau/${organizationId}/schools`)
export const assignRequiredSchools = (
  baseUrl: string,
  organizationId: string,
  periodId: string,
  schoolIds: string[],
) =>
  request(baseUrl, `/bureau/${organizationId}/periods/${periodId}/schools`, {
    method: 'PUT',
    body: JSON.stringify({ schoolIds }),
  })
export const removeRequiredSchool = (
  baseUrl: string,
  organizationId: string,
  periodId: string,
  schoolId: string,
) =>
  request(
    baseUrl,
    `/bureau/${organizationId}/periods/${periodId}/schools/${schoolId}`,
    {
      method: 'DELETE',
    },
  )
