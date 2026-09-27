import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const status = z.enum([
  'submitted',
  'underReview',
  'approved',
  'rejected',
  'fulfilled',
  'cancelled',
])
const request = z.object({
  id,
  schoolId: id,
  studentId: id,
  type: z.enum(['access', 'correction', 'restriction', 'objection']),
  status,
  details: z.string(),
  correctionField: z
    .enum(['givenName', 'familyName', 'dateOfBirth'])
    .nullable()
    .optional(),
  restrictionCategory: z
    .enum(['parentPortalSharing', 'publicDocumentVerification'])
    .nullable()
    .optional(),
  officialCorrectionRequestId: id.nullable().optional(),
  createdAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
  fulfilledAt: z.iso.datetime().nullable(),
})
const subject = z.object({
  schoolId: id,
  studentId: id,
  studentReference: z.string(),
  displayName: z.string(),
  requesterKind: z.enum(['student', 'guardian']),
})
const page = z.object({
  total: z.number(),
  items: z.array(request),
  take: z.number(),
  skip: z.number(),
})
const detail = request.extend({ accessPackage: z.unknown().nullable() })
export type PrivacyRequest = z.infer<typeof request>
export type PrivacySubject = z.infer<typeof subject>
const schoolPath = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/privacy`
const post = (baseUrl: string, path: string, body: unknown) =>
  requestJson(baseUrl, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
export async function getPrivacySubjects(baseUrl: string) {
  return z
    .array(subject)
    .parse(await requestJson(baseUrl, '/privacy/subjects/mine'))
}
export async function getOwnPrivacyRequests(baseUrl: string) {
  return page.parse(await requestJson(baseUrl, '/privacy/requests/mine'))
}
export async function getOwnPrivacyRequest(baseUrl: string, requestId: string) {
  return detail.parse(
    await requestJson(
      baseUrl,
      `/privacy/requests/${encodeURIComponent(requestId)}`,
    ),
  )
}
export async function submitPrivacyRequest(
  baseUrl: string,
  schoolId: string,
  input: {
    studentId: string
    type: PrivacyRequest['type']
    details: string
    correctionField?: string
    correctionValue?: string | null
    restrictionCategory?: string
  },
) {
  await post(baseUrl, `${schoolPath(schoolId)}/requests`, input)
}
export async function cancelPrivacyRequest(baseUrl: string, requestId: string) {
  await post(
    baseUrl,
    `/privacy/requests/${encodeURIComponent(requestId)}/cancel`,
    {},
  )
}
export async function getStaffPrivacyRequests(
  baseUrl: string,
  schoolId: string,
) {
  return page
    .extend({
      items: z.array(
        request.extend({
          requesterKind: z.enum(['student', 'guardian']),
          requester: z.object({ displayName: z.string() }),
          correctionValue: z.string().nullable(),
        }),
      ),
    })
    .parse(await requestJson(baseUrl, `${schoolPath(schoolId)}/requests`))
}
export async function actOnPrivacyRequest(
  baseUrl: string,
  schoolId: string,
  requestId: string,
  action: 'review' | 'approve' | 'reject' | 'fulfill' | 'applyRestriction',
  reason?: string,
) {
  await post(
    baseUrl,
    `${schoolPath(schoolId)}/requests/${encodeURIComponent(requestId)}/${action}`,
    reason ? { reason } : {},
  )
}
