import { z } from 'zod'
import { requestJson } from './api'

const requestSchema = z.strictObject({
  id: z.uuid(),
  schoolId: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
  status: z.enum(['requested', 'processing', 'ready', 'rejected', 'cancelled']),
  requestedAt: z.iso.datetime(),
  rejectionReason: z.string().nullable(),
  issuedDocumentId: z.uuid().nullable(),
  verificationReference: z.string().nullable(),
})
const workspaceSchema = z.strictObject({
  requests: z.array(requestSchema),
  eligibleYears: z.array(
    z.strictObject({
      schoolId: z.uuid(),
      school: z.string(),
      academicYearId: z.uuid(),
      academicYear: z.string(),
    }),
  ),
})
export type StudentDocumentWorkspace = z.infer<typeof workspaceSchema>

export async function getStudentDocumentWorkspace(baseUrl: string) {
  return workspaceSchema.parse(await requestJson(baseUrl, '/student/documents'))
}
export async function requestStudentDocument(
  baseUrl: string,
  schoolId: string,
  academicYearId: string,
  documentType: 'reportCard' | 'transcript',
) {
  await requestJson(baseUrl, '/student/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schoolId, academicYearId, documentType }),
  })
}
export async function cancelStudentDocument(
  baseUrl: string,
  requestId: string,
) {
  await requestJson(baseUrl, `/student/documents/${requestId}/cancel`, {
    method: 'POST',
  })
}
