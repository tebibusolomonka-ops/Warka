import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const status = z.enum(['draft', 'reviewed', 'applied', 'cancelled'])
const action = z.enum(['promote', 'repeat', 'withdraw', 'manualReview'])
const entrySchema = z.object({
  id,
  studentId: id,
  sourceEnrollmentId: id,
  action,
  targetGradeLevelId: id.nullable(),
  targetSchoolClassId: id.nullable(),
  student: z.object({
    studentReference: z.string(),
    givenName: z.string(),
    familyName: z.string().nullable(),
  }),
  sourceEnrollment: z.object({
    gradeLevelId: id,
    schoolClassId: id.nullable(),
  }),
})
const planSchema = z.object({
  id,
  schoolId: id,
  sourceAcademicYearId: id,
  targetAcademicYearId: id,
  status,
  entries: z.array(entrySchema),
})
const previewSchema = z.object({
  planId: id,
  status,
  counts: z.object({
    promote: z.number(),
    repeat: z.number(),
    withdraw: z.number(),
    manualReview: z.number(),
  }),
  problems: z.array(z.object({ code: z.string(), entryId: id.optional() })),
  blockingErrors: z.number(),
})
const exceptionSchema = z.object({
  id,
  entryId: id,
  kind: z.string(),
  status: z.enum(['open', 'resolved']),
  resolutionNote: z.string().nullable(),
})
const readinessSchema = z.object({
  yearId: id,
  status: z.enum(['active', 'closing', 'closed']),
  blockers: z.array(z.object({ kind: z.string(), count: z.number() })),
  canClose: z.boolean(),
})
const resultSchema = z.object({
  planId: id,
  newEnrollments: z.number(),
  promotions: z.number(),
  repeats: z.number(),
  withdrawalDecisions: z.number(),
  sourceEnrollmentsPreserved: z.number(),
})
export type RolloverPlan = z.infer<typeof planSchema>
export type RolloverPreview = z.infer<typeof previewSchema>
export type RolloverException = z.infer<typeof exceptionSchema>
export type RolloverReadiness = z.infer<typeof readinessSchema>
export type RolloverResult = z.infer<typeof resultSchema>
const path = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`
const planPath = (schoolId: string, planId: string) =>
  `${path(schoolId)}/progression-plans/${encodeURIComponent(planId)}`
const post = (baseUrl: string, route: string, body: unknown = {}) =>
  requestJson(baseUrl, route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export async function getYearReadiness(
  baseUrl: string,
  schoolId: string,
  yearId: string,
) {
  return readinessSchema.parse(
    await requestJson(
      baseUrl,
      `${path(schoolId)}/years/${yearId}/closing-readiness`,
    ),
  )
}
export async function startYearClosing(
  baseUrl: string,
  schoolId: string,
  yearId: string,
) {
  await post(baseUrl, `${path(schoolId)}/years/${yearId}/closing/start`)
}
export async function completeYearClosing(
  baseUrl: string,
  schoolId: string,
  yearId: string,
) {
  await post(baseUrl, `${path(schoolId)}/years/${yearId}/closing/complete`)
}
export async function createRolloverPlan(
  baseUrl: string,
  schoolId: string,
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
) {
  const created = z.object({ id }).parse(
    await post(baseUrl, `${path(schoolId)}/progression-plans`, {
      sourceAcademicYearId,
      targetAcademicYearId,
    }),
  )
  return getRolloverPlan(baseUrl, schoolId, created.id)
}
export async function getRolloverPlan(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  return planSchema.parse(
    await requestJson(baseUrl, planPath(schoolId, planId)),
  )
}
export async function updateRolloverEntry(
  baseUrl: string,
  schoolId: string,
  planId: string,
  entryId: string,
  input: {
    action: z.infer<typeof action>
    targetGradeLevelId?: string | null
    targetSchoolClassId?: string | null
  },
) {
  await requestJson(
    baseUrl,
    `${planPath(schoolId, planId)}/entries/${entryId}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}
export async function bulkPromoteRollover(
  baseUrl: string,
  schoolId: string,
  planId: string,
  input: {
    sourceGradeLevelId: string
    sourceSchoolClassId?: string | null
    targetGradeLevelId: string
    targetSchoolClassId?: string | null
  },
) {
  await post(baseUrl, `${planPath(schoolId, planId)}/bulk-promotions`, input)
}
export async function bulkDecideRollover(
  baseUrl: string,
  schoolId: string,
  planId: string,
  input: {
    entryIds: string[]
    action: 'repeat' | 'withdraw' | 'manualReview'
    targetGradeLevelId?: string | null
    targetSchoolClassId?: string | null
  },
) {
  await post(baseUrl, `${planPath(schoolId, planId)}/bulk-decisions`, input)
}
export async function previewRollover(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  return previewSchema.parse(
    await requestJson(baseUrl, `${planPath(schoolId, planId)}/preview`),
  )
}
export async function reviewRollover(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  await post(baseUrl, `${planPath(schoolId, planId)}/review`)
}
export async function applyRollover(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  return resultSchema.parse(
    await post(baseUrl, `${planPath(schoolId, planId)}/apply`),
  )
}
export async function getRolloverExceptions(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  return z
    .object({ exceptions: z.array(exceptionSchema) })
    .parse(
      await requestJson(baseUrl, `${planPath(schoolId, planId)}/exceptions`),
    ).exceptions
}
export async function refreshRolloverExceptions(
  baseUrl: string,
  schoolId: string,
  planId: string,
) {
  return z
    .object({ exceptions: z.array(exceptionSchema) })
    .parse(
      await post(baseUrl, `${planPath(schoolId, planId)}/exceptions/refresh`),
    ).exceptions
}
export async function resolveRolloverException(
  baseUrl: string,
  schoolId: string,
  planId: string,
  exceptionId: string,
  note: string,
) {
  await post(
    baseUrl,
    `${planPath(schoolId, planId)}/exceptions/${exceptionId}/resolve`,
    { note },
  )
}
