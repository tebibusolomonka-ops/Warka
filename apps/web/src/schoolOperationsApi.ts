import { z } from 'zod'
import { ApiError, requestJson } from './api'

const ImportIssueSchema = z.object({
  rowNumber: z.number().int(),
  severity: z.enum(['error', 'warning']),
  code: z.string(),
  message: z.string(),
})
const ImportJobSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  status: z.enum(['uploaded', 'validated', 'invalid', 'applied', 'cancelled']),
  originalFileName: z.string().nullable(),
  totalRows: z.number().int(),
  validRows: z.number().int(),
  invalidRows: z.number().int(),
  createdAt: z.iso.datetime(),
  issues: z.array(ImportIssueSchema).optional(),
})
export type ImportJob = z.infer<typeof ImportJobSchema>
const ApplyResponseSchema = z.object({
  job: ImportJobSchema,
  created: z.array(
    z.object({ studentId: z.string(), studentReference: z.string() }),
  ),
})
function path(schoolId: string) {
  return `/schools/${encodeURIComponent(schoolId)}/imports`
}
function csvOptions(csv: string, originalFileName: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ csv, originalFileName }),
  }
}
export async function listSchoolImports(baseUrl: string, schoolId: string) {
  return z
    .array(ImportJobSchema)
    .parse(await requestJson(baseUrl, path(schoolId)))
}
export async function getSchoolImport(
  baseUrl: string,
  schoolId: string,
  jobId: string,
) {
  return ImportJobSchema.parse(
    await requestJson(
      baseUrl,
      `${path(schoolId)}/${encodeURIComponent(jobId)}`,
    ),
  )
}
export async function uploadSchoolImport(
  baseUrl: string,
  schoolId: string,
  csv: string,
  fileName: string,
) {
  return ImportJobSchema.parse(
    await requestJson(baseUrl, path(schoolId), csvOptions(csv, fileName)),
  )
}
export async function validateSchoolImport(
  baseUrl: string,
  schoolId: string,
  jobId: string,
  csv: string,
  fileName: string,
) {
  return ImportJobSchema.parse(
    await requestJson(
      baseUrl,
      `${path(schoolId)}/${encodeURIComponent(jobId)}/validate`,
      csvOptions(csv, fileName),
    ),
  )
}
export async function applySchoolImport(
  baseUrl: string,
  schoolId: string,
  jobId: string,
  acknowledgeWarnings: boolean,
) {
  return ApplyResponseSchema.parse(
    await requestJson(
      baseUrl,
      `${path(schoolId)}/${encodeURIComponent(jobId)}/apply`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acknowledgeWarnings }),
      },
    ),
  )
}
export async function cancelSchoolImport(
  baseUrl: string,
  schoolId: string,
  jobId: string,
) {
  return ImportJobSchema.parse(
    await requestJson(
      baseUrl,
      `${path(schoolId)}/${encodeURIComponent(jobId)}/cancel`,
      { method: 'POST' },
    ),
  )
}
export const SchoolExportTypeSchema = z.enum([
  'studentRoster',
  'approvedEnrollmentRoster',
  'publishedResults',
])
export type SchoolExportType = z.infer<typeof SchoolExportTypeSchema>
export async function downloadSchoolExport(
  baseUrl: string,
  schoolId: string,
  type: SchoolExportType,
  request: typeof fetch = fetch,
) {
  const response = await request(
    `${baseUrl}/schools/${encodeURIComponent(schoolId)}/exports/${type}`,
    { credentials: 'include' },
  )
  if (!response.ok)
    throw new ApiError(
      'Could not download the school export.',
      response.status,
      'EXPORT_FAILED',
    )
  const csv = await response.blob()
  const url = URL.createObjectURL(csv)
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
