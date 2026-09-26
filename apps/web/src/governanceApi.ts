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
      body.error?.message ?? 'Governance request failed',
      response.status,
      body.error?.code ?? 'GOVERNANCE_REQUEST_FAILED',
    )
  return body
}

export type AuditEvent = {
  id: string
  action: string
  resourceType: string
  resourceId?: string
  actorUserId?: string
  occurredAt: string
  metadata: Record<string, string | number | boolean | null>
}

export type ReviewEntry = {
  id: string
  userId: string
  accessType: string
  currentRole: string
  schoolId?: string
  decision: 'pending' | 'confirmed' | 'revoke'
  user: { displayName: string; email: string } | null
}

export type AccessReview = {
  id: string
  status: 'open' | 'completed'
  startedAt: string
  completedAt?: string
  entries: ReviewEntry[]
}

export type SupportIdentity = {
  id: string
  displayName: string
  email: string
}

export type SupportGrant = {
  id: string
  supportUserId: string
  schoolId: string
  reason: string
  status: 'pending' | 'approved' | 'revoked'
  expiresAt: string
  revokedAt?: string
  supportUser: SupportIdentity | null
}

export type RetentionCategory =
  | 'messages'
  | 'auditEvents'
  | 'issuedDocuments'
  | 'academicRecords'
  | 'enrollmentRecords'

export type RetentionPolicy = {
  id: string
  category: RetentionCategory
  retentionDays: number
}

export type RetentionEvaluation = {
  category: RetentionCategory
  retentionDays: number
  eligibleCount: number
  oldestEligibleAt: string | null
  cutoff: string
}

export const listAudit = (baseUrl: string, organizationId: string) =>
  request<AuditEvent[]>(baseUrl, `/governance/${organizationId}/audit?take=50`)

export const listReviews = (baseUrl: string, organizationId: string) =>
  request<Array<Omit<AccessReview, 'entries'>>>(
    baseUrl,
    `/governance/${organizationId}/reviews`,
  )

export const createReview = (baseUrl: string, organizationId: string) =>
  request<AccessReview>(baseUrl, `/governance/${organizationId}/reviews`, {
    method: 'POST',
    body: '{}',
  })

export const getReview = (
  baseUrl: string,
  organizationId: string,
  reviewId: string,
) =>
  request<AccessReview>(
    baseUrl,
    `/governance/${organizationId}/reviews/${reviewId}`,
  )

export const decideReviewEntry = (
  baseUrl: string,
  organizationId: string,
  reviewId: string,
  entryId: string,
  decision: 'confirmed' | 'revoke',
) =>
  request<ReviewEntry>(
    baseUrl,
    `/governance/${organizationId}/reviews/${reviewId}/entries/${entryId}`,
    { method: 'PATCH', body: JSON.stringify({ decision }) },
  )

export const completeReview = (
  baseUrl: string,
  organizationId: string,
  reviewId: string,
) =>
  request<AccessReview>(
    baseUrl,
    `/governance/${organizationId}/reviews/${reviewId}/complete`,
    { method: 'POST' },
  )

export const listSupportUsers = (
  baseUrl: string,
  organizationId: string,
  schoolId: string,
) =>
  request<SupportIdentity[]>(
    baseUrl,
    `/governance/${organizationId}/support/identities?schoolId=${schoolId}`,
  )

export const listSupportGrants = (
  baseUrl: string,
  organizationId: string,
  schoolId: string,
) =>
  request<SupportGrant[]>(
    baseUrl,
    `/governance/${organizationId}/support/grants?schoolId=${schoolId}`,
  )

export const requestSupportGrant = (
  baseUrl: string,
  organizationId: string,
  body: {
    supportUserId: string
    schoolId: string
    reason: string
    expiresAt: string
  },
) =>
  request<SupportGrant>(
    baseUrl,
    `/governance/${organizationId}/support/grants`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export const actOnSupportGrant = (
  baseUrl: string,
  organizationId: string,
  grantId: string,
  action: 'approve' | 'revoke',
) =>
  request<SupportGrant>(
    baseUrl,
    `/governance/${organizationId}/support/grants/${grantId}/${action}`,
    { method: 'POST' },
  )

export const listRetention = (baseUrl: string, organizationId: string) =>
  request<RetentionPolicy[]>(baseUrl, `/governance/${organizationId}/retention`)

export const saveRetention = (
  baseUrl: string,
  organizationId: string,
  category: RetentionCategory,
  retentionDays: number,
) =>
  request<RetentionPolicy>(
    baseUrl,
    `/governance/${organizationId}/retention/${category}`,
    { method: 'PUT', body: JSON.stringify({ retentionDays }) },
  )

export const evaluateRetention = (
  baseUrl: string,
  organizationId: string,
  category: RetentionCategory,
) =>
  request<RetentionEvaluation>(
    baseUrl,
    `/governance/${organizationId}/retention/${category}/evaluate`,
    { method: 'POST' },
  )
