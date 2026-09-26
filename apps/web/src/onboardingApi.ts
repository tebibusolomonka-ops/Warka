import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const path = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`
const action = (
  baseUrl: string,
  schoolId: string,
  suffix: string,
  body?: unknown,
) =>
  requestJson(baseUrl, `${path(schoolId)}/onboarding/${suffix}`, {
    method: 'POST',
    ...(body
      ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
const stateSchema = z.object({
  id,
  status: z.enum([
    'notStarted',
    'inProgress',
    'readyForReview',
    'completed',
    'paused',
  ]),
})
const checklistSchema = z.array(
  z.object({
    key: z.string(),
    source: z.enum(['system', 'manual']),
    status: z.enum(['pending', 'complete', 'notApplicable']),
  }),
)
const readinessSchema = z.object({
  status: z.enum(['ready', 'warning', 'blocked']),
  checks: z.array(
    z.object({
      key: z.string(),
      status: z.enum(['ready', 'warning', 'blocked']),
      reason: z.string(),
    }),
  ),
})
const contactSchema = z.object({
  id,
  name: z.string(),
  role: z.enum(['primary', 'technical', 'records', 'emergency']),
  email: z.string().nullable(),
  phone: z.string().nullable(),
})
const trainingSchema = z.object({
  id,
  userId: id,
  trainingType: z.string(),
  status: z.enum(['assigned', 'completed', 'waived']),
  waiverReason: z.string().nullable(),
  user: z.object({ displayName: z.string() }),
})
export type OnboardingState = z.infer<typeof stateSchema> | null
export type ChecklistItem = z.infer<typeof checklistSchema>[number]
export type Readiness = z.infer<typeof readinessSchema>
export type SchoolContact = z.infer<typeof contactSchema>
export type TrainingRecord = z.infer<typeof trainingSchema>
export async function getOnboarding(baseUrl: string, schoolId: string) {
  const value = await requestJson(baseUrl, `${path(schoolId)}/onboarding`)
  return value === null ? null : stateSchema.parse(value)
}
export async function startOnboarding(baseUrl: string, schoolId: string) {
  await action(baseUrl, schoolId, 'start')
}
export async function pauseOnboarding(baseUrl: string, schoolId: string) {
  await action(baseUrl, schoolId, 'pause')
}
export async function submitOnboarding(baseUrl: string, schoolId: string) {
  await action(baseUrl, schoolId, 'submit')
}
export async function completeOnboarding(baseUrl: string, schoolId: string) {
  await action(baseUrl, schoolId, 'complete')
}
export async function getChecklist(baseUrl: string, schoolId: string) {
  return checklistSchema.parse(
    await requestJson(baseUrl, `${path(schoolId)}/onboarding/checklist`),
  )
}
export async function updateChecklist(
  baseUrl: string,
  schoolId: string,
  key: string,
  status: 'pending' | 'complete' | 'notApplicable',
) {
  await requestJson(
    baseUrl,
    `${path(schoolId)}/onboarding/checklist/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
}
export async function getReadiness(baseUrl: string, schoolId: string) {
  return readinessSchema.parse(
    await requestJson(baseUrl, `${path(schoolId)}/onboarding/readiness`),
  )
}
export async function getContacts(baseUrl: string, schoolId: string) {
  return z
    .array(contactSchema)
    .parse(await requestJson(baseUrl, `${path(schoolId)}/contacts`))
}
export async function addContact(
  baseUrl: string,
  schoolId: string,
  input: {
    name: string
    role: string
    email: string | null
    phone: string | null
  },
) {
  await requestJson(baseUrl, `${path(schoolId)}/contacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}
export async function getTraining(baseUrl: string, schoolId: string) {
  return z
    .array(trainingSchema)
    .parse(await requestJson(baseUrl, `${path(schoolId)}/onboarding/training`))
}
export async function assignTraining(
  baseUrl: string,
  schoolId: string,
  userId: string,
  trainingType: string,
) {
  await action(baseUrl, schoolId, 'training', { userId, trainingType })
}
export async function finishTraining(
  baseUrl: string,
  schoolId: string,
  recordId: string,
  actionName: 'completed' | 'waived',
  reason?: string,
) {
  await action(baseUrl, schoolId, `training/${recordId}/finish`, {
    action: actionName,
    ...(reason ? { reason } : {}),
  })
}
