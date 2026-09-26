import { z } from 'zod'
import { requestJson } from './api'

const id = z.uuid()
const status = z.enum([
  'open',
  'inProgress',
  'waitingForSchool',
  'resolved',
  'closed',
])
const item = z.object({
  id,
  schoolId: id,
  category: z.string(),
  severity: z.string(),
  title: z.string(),
  description: z.string(),
  status,
  resolutionSummary: z.string().nullable().optional(),
})
const detail = item.extend({
  messages: z.array(
    z.object({
      id,
      body: z.string(),
      senderId: id,
      createdAt: z.iso.datetime(),
    }),
  ),
})
export type SupportItem = z.infer<typeof item>
export type SupportDetail = z.infer<typeof detail>
const path = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/support-requests`
const post = (baseUrl: string, route: string, body?: unknown) =>
  requestJson(baseUrl, route, {
    method: 'POST',
    ...(body
      ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
export async function getSupportCaseSchools(baseUrl: string) {
  return z
    .array(z.object({ id, name: z.string() }))
    .parse(await requestJson(baseUrl, '/support/me/schools'))
}
export async function getSupportCases(baseUrl: string, schoolId: string) {
  return z.array(item).parse(await requestJson(baseUrl, path(schoolId)))
}
export async function getSupportCase(
  baseUrl: string,
  schoolId: string,
  requestId: string,
) {
  return detail.parse(
    await requestJson(baseUrl, `${path(schoolId)}/${requestId}`),
  )
}
export async function createSupportCase(
  baseUrl: string,
  schoolId: string,
  input: {
    category: string
    severity: string
    title: string
    description: string
  },
) {
  return item.parse(await post(baseUrl, path(schoolId), input))
}
export async function replyToSupportCase(
  baseUrl: string,
  schoolId: string,
  requestId: string,
  body: string,
) {
  await post(baseUrl, `${path(schoolId)}/${requestId}/replies`, { body })
}
export async function resolveSupportCase(
  baseUrl: string,
  schoolId: string,
  requestId: string,
  summary: string,
) {
  await post(baseUrl, `${path(schoolId)}/${requestId}/resolve`, { summary })
}
export async function closeSupportCase(
  baseUrl: string,
  schoolId: string,
  requestId: string,
) {
  await post(baseUrl, `${path(schoolId)}/${requestId}/close`)
}
