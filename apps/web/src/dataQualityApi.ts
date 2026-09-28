import { requestJson } from './api'

export type QualityIssue = {
  id: string
  category: string
  severity: 'info' | 'warning' | 'blocking'
  code: string
  status: 'open' | 'resolved' | 'dismissed'
  summary: string
  entityType: string | null
  entityId: string | null
  detectedAt: string
  resolvedAt: string | null
  dismissalReason: string | null
}
export type QualityRun = {
  id: string
  status: 'running' | 'completed' | 'failed'
  trigger: string
  startedAt: string
  completedAt: string | null
  infoCount: number
  warningCount: number
  blockingCount: number
}
const root = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/data-quality`
export async function getLatestQualityRun(baseUrl: string, schoolId: string) {
  return (await requestJson(baseUrl, `${root(schoolId)}/runs/latest`)) as {
    run: QualityRun | null
  }
}
export async function listQualityIssues(
  baseUrl: string,
  schoolId: string,
  filters: {
    category?: string
    severity?: string
    status?: string
    cursor?: string
  } = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  )
  return (await requestJson(baseUrl, `${root(schoolId)}/issues?${query}`)) as {
    issues: QualityIssue[]
    nextCursor: string | null
  }
}
export async function runQualityChecks(baseUrl: string, schoolId: string) {
  return requestJson(baseUrl, `${root(schoolId)}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      checks: ['student', 'enrollment', 'academic', 'document'],
    }),
  })
}
export async function dismissQualityIssue(
  baseUrl: string,
  schoolId: string,
  issueId: string,
  reason: string,
) {
  return requestJson(
    baseUrl,
    `${root(schoolId)}/issues/${encodeURIComponent(issueId)}/dismiss`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  )
}
