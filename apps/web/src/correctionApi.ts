import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const person = z.object({
  id,
  givenName: z.string(),
  familyName: z.string().nullable(),
  studentReference: z.string(),
})
const base = z.object({
  id,
  reason: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  requestedAt: z.iso.datetime(),
  requestedBy: z.object({ id, displayName: z.string() }),
  reviewReason: z.string().nullable(),
  effectiveAt: z.iso.datetime().nullable(),
})
const studentRequest = base.extend({
  studentId: id,
  field: z.enum(['givenName', 'familyName', 'dateOfBirth']),
  previousValue: z.string().nullable(),
  proposedValue: z.string().nullable(),
  student: person,
})
const enrollmentRequest = base.extend({
  enrollmentId: id,
  previousGradeLevelId: id,
  previousSchoolClassId: id.nullable(),
  proposedGradeLevelId: id,
  proposedSchoolClassId: id.nullable(),
  enrollment: z.object({ student: person }),
})
const page = <T extends z.ZodType>(item: T) =>
  z.object({
    total: z.number(),
    items: z.array(item),
    take: z.number(),
    skip: z.number(),
  })
export type StudentCorrection = z.infer<typeof studentRequest>
export type EnrollmentCorrection = z.infer<typeof enrollmentRequest>
const path = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`
const post = (baseUrl: string, suffix: string, body: unknown) =>
  requestJson(baseUrl, suffix, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
export async function getCorrections(
  baseUrl: string,
  schoolId: string,
  kind: 'student' | 'enrollment',
  query: URLSearchParams,
) {
  const result = await requestJson(
    baseUrl,
    `${path(schoolId)}/corrections/${kind}?${query}`,
  )
  return kind === 'student'
    ? page(studentRequest).parse(result)
    : page(enrollmentRequest).parse(result)
}
export async function requestStudentCorrection(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  input: { field: string; proposedValue: string | null; reason: string },
) {
  await post(
    baseUrl,
    `${path(schoolId)}/students/${encodeURIComponent(studentId)}/corrections`,
    input,
  )
}
export async function requestEnrollmentCorrection(
  baseUrl: string,
  schoolId: string,
  enrollmentId: string,
  input: {
    proposedGradeLevelId: string
    proposedSchoolClassId: string | null
    reason: string
  },
) {
  await post(
    baseUrl,
    `${path(schoolId)}/enrollments/${encodeURIComponent(enrollmentId)}/corrections`,
    input,
  )
}
export async function decideCorrection(
  baseUrl: string,
  schoolId: string,
  kind: 'student' | 'enrollment',
  requestId: string,
  decision: 'approve' | 'reject',
  reason?: string,
) {
  await post(
    baseUrl,
    `${path(schoolId)}/corrections/${kind}/${encodeURIComponent(requestId)}/${decision}`,
    reason ? { reason } : {},
  )
}
