import { ApiError } from './api'

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(baseUrl + path, {
    ...init,
    credentials: 'include',
    ...(init?.body === undefined
      ? init?.headers
        ? { headers: init.headers }
        : {}
      : { headers: { 'content-type': 'application/json', ...init?.headers } }),
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
  opensAt?: string | null
  dueAt?: string | null
  closesAt?: string | null
  requirements: Array<{ school: { id: string; name: string } }>
}
export type Submission = {
  id: string
  status: 'draft' | 'submitted' | 'underReview' | 'approved' | 'returned'
  snapshot: Record<string, unknown>
  currentVersion?: number
  acceptedVersion?: number | null
  versions?: ReportingVersion[]
  submittedAt?: string
  approvedAt?: string
  returnReason?: string
  school: { id: string; name: string }
  reportingPeriod: { id: string; name: string }
}
export type ReportingVersion = {
  id: string
  version: number
  snapshot: Record<string, unknown>
  snapshotChecksum?: string | null
  provenance: 'nativeVersion' | 'legacyBackfill'
  integrityState: 'verified' | 'legacyUnverified'
  submittedAt: string
  status: string
  resubmissionReason?: string | null
}
export type ReportingNote = {
  id: string
  version: number
  body: string
  visibility: 'schoolAndBureau' | 'bureauInternal'
  createdAt: string
  authorUser: { displayName: string }
}
export type ReportingReadiness = {
  ready: boolean
  warnings: string[]
  blocking: string[]
  communicationScheduling?: {
    status: 'ready' | 'degraded' | 'disabled'
    reasons: string[]
  }
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
      underReview: number
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
  action: 'start-review' | 'approve' | 'return',
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
export const resubmitReport = (
  baseUrl: string,
  schoolId: string,
  periodId: string,
  reason: string,
) =>
  request<Submission>(
    baseUrl,
    `/schools/${schoolId}/reporting/${periodId}/resubmit`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  )
export const getReportingReadiness = (
  baseUrl: string,
  schoolId: string,
  periodId: string,
) =>
  request<ReportingReadiness>(
    baseUrl,
    `/schools/${schoolId}/reporting/${periodId}/readiness`,
  )
export const listSchoolReportingNotes = (
  baseUrl: string,
  schoolId: string,
  periodId: string,
) =>
  request<ReportingNote[]>(
    baseUrl,
    `/schools/${schoolId}/reporting/${periodId}/notes`,
  )
export const addSchoolReportingNote = (
  baseUrl: string,
  schoolId: string,
  periodId: string,
  body: string,
) =>
  request<ReportingNote>(
    baseUrl,
    `/schools/${schoolId}/reporting/${periodId}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  )
export const listBureauReportingNotes = (
  baseUrl: string,
  organizationId: string,
  submissionId: string,
) =>
  request<ReportingNote[]>(
    baseUrl,
    `/bureau/${organizationId}/submissions/${submissionId}/notes`,
  )
export const addBureauReportingNote = (
  baseUrl: string,
  organizationId: string,
  submissionId: string,
  body: string,
  visibility: 'schoolAndBureau' | 'bureauInternal',
) =>
  request<ReportingNote>(
    baseUrl,
    `/bureau/${organizationId}/submissions/${submissionId}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({ body, visibility }),
    },
  )
export const getRegionalValidation = (
  baseUrl: string,
  organizationId: string,
  periodId: string,
) =>
  request<{
    issues: { schoolId: string | null; code: string; severity: string }[]
  }>(baseUrl, `/bureau/${organizationId}/periods/${periodId}/validation`)
export async function downloadReportingExport(
  baseUrl: string,
  organizationId: string,
  periodId: string,
  type: 'coverage' | 'enrollment' | 'academic' | 'transfers',
) {
  const response = await fetch(
    `${baseUrl}/bureau/${organizationId}/periods/${periodId}/exports/${type}`,
    {
      credentials: 'include',
    },
  )
  if (!response.ok)
    throw new ApiError(
      'Reporting export failed',
      response.status,
      'REPORTING_EXPORT_FAILED',
    )
  return response.text()
}

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
