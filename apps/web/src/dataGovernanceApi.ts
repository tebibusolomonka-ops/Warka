import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const summary = z.object({
  organizationId: id,
  schoolId: id,
  openRequests: z.number(),
  statuses: z.array(z.object({ status: z.string(), count: z.number() })),
  activeRestrictions: z.number(),
  recentCorrections: z.array(
    z.object({
      id,
      status: z.string(),
      requestedAt: z.iso.datetime(),
      field: z.string(),
    }),
  ),
  recentStaffChanges: z.array(
    z.object({ id, action: z.string(), occurredAt: z.iso.datetime() }),
  ),
})
const hold = z.object({
  id,
  scope: z.enum(['student', 'privacyRequest', 'issuedDocument']),
  studentId: id.nullable(),
  privacyRequestId: id.nullable(),
  issuedDocumentId: id.nullable(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
  releasedAt: z.iso.datetime().nullable(),
})
export type GovernanceSummary = z.infer<typeof summary>
export type RetentionHold = z.infer<typeof hold>
export async function getDataGovernanceSummary(
  baseUrl: string,
  schoolId: string,
) {
  return summary.parse(
    await requestJson(
      baseUrl,
      `/schools/${encodeURIComponent(schoolId)}/data-governance/summary`,
    ),
  )
}
export async function getRetentionHolds(
  baseUrl: string,
  organizationId: string,
) {
  return z
    .object({ total: z.number(), items: z.array(hold) })
    .parse(
      await requestJson(
        baseUrl,
        `/governance/${encodeURIComponent(organizationId)}/retention/holds`,
      ),
    )
}
export async function createRetentionHold(
  baseUrl: string,
  organizationId: string,
  input: { scope: RetentionHold['scope']; recordId: string; reason: string },
) {
  await requestJson(
    baseUrl,
    `/governance/${encodeURIComponent(organizationId)}/retention/holds`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}
export async function releaseRetentionHold(
  baseUrl: string,
  organizationId: string,
  holdId: string,
) {
  await requestJson(
    baseUrl,
    `/governance/${encodeURIComponent(organizationId)}/retention/holds/${encodeURIComponent(holdId)}/release`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  )
}
