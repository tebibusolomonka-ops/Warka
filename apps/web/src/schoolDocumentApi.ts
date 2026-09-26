import { z } from 'zod'
import { requestJson } from './api'

const requestSchema = z.strictObject({
  id: z.uuid(),
  student: z.string(),
  studentReference: z.string(),
  documentType: z.enum(['reportCard', 'transcript']),
  academicYear: z.string(),
  status: z.enum(['requested', 'processing', 'ready', 'rejected', 'cancelled']),
  requestedAt: z.iso.datetime(),
  rejectionReason: z.string().nullable(),
  issuedDocumentId: z.uuid().nullable(),
  verificationReference: z.string().nullable(),
})
const documentSchema = z.strictObject({
  id: z.uuid(),
  studentId: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
  status: z.enum(['active', 'corrected', 'withdrawn']),
  issuedAt: z.iso.datetime(),
  verificationReference: z.string(),
  supersedesId: z.uuid().nullable(),
})
const profileSchema = z.object({
  officialName: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  documentFooter: z.string().nullable(),
})
export type SchoolDocumentRequest = z.infer<typeof requestSchema>
export type SchoolIssuedDocument = z.infer<typeof documentSchema>
export type SchoolDocumentProfile = z.infer<typeof profileSchema>

export async function listSchoolDocumentRequests(
  baseUrl: string,
  schoolId: string,
  status: string,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return z
    .strictObject({ requests: z.array(requestSchema) })
    .parse(
      await requestJson(
        baseUrl,
        `/schools/${schoolId}/document-requests${query}`,
      ),
    ).requests
}
export async function getSchoolDocumentRequest(
  baseUrl: string,
  schoolId: string,
  requestId: string,
) {
  return requestSchema.parse(
    await requestJson(
      baseUrl,
      `/schools/${schoolId}/document-requests/${requestId}`,
    ),
  )
}
export async function actOnSchoolDocumentRequest(
  baseUrl: string,
  schoolId: string,
  requestId: string,
  action: 'start' | 'issue' | 'reject',
  reason?: string,
) {
  await requestJson(
    baseUrl,
    `/schools/${schoolId}/document-requests/${requestId}/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  )
}
export async function listSchoolIssuedDocuments(
  baseUrl: string,
  schoolId: string,
) {
  return z
    .strictObject({ documents: z.array(documentSchema) })
    .parse(await requestJson(baseUrl, `/schools/${schoolId}/issued-documents`))
    .documents
}
export async function getSchoolDocumentProfile(
  baseUrl: string,
  schoolId: string,
) {
  const value = await requestJson(
    baseUrl,
    `/schools/${schoolId}/document-profile`,
  )
  return value === null ? null : profileSchema.parse(value)
}
export async function saveSchoolDocumentProfile(
  baseUrl: string,
  schoolId: string,
  profile: Partial<SchoolDocumentProfile>,
) {
  return profileSchema.parse(
    await requestJson(baseUrl, `/schools/${schoolId}/document-profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profile),
    }),
  )
}
