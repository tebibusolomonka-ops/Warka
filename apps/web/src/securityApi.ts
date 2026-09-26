import { z } from 'zod'
import { requestJson } from './api'

const sessionsSchema = z.object({
  sessions: z.array(
    z.object({
      managementId: z.uuid(),
      createdAt: z.iso.datetime(),
      expiresAt: z.iso.datetime(),
      current: z.boolean(),
    }),
  ),
})
export type SafeSession = z.infer<typeof sessionsSchema>['sessions'][number]
export async function getOwnSessions(baseUrl: string) {
  return sessionsSchema.parse(await requestJson(baseUrl, '/auth/sessions'))
    .sessions
}
export async function revokeOwnSession(baseUrl: string, managementId: string) {
  await requestJson(
    baseUrl,
    `/auth/sessions/${encodeURIComponent(managementId)}`,
    { method: 'DELETE' },
  )
}
export async function revokeOtherSessions(baseUrl: string) {
  await requestJson(baseUrl, '/auth/sessions/others', { method: 'DELETE' })
}
export async function requestRecovery(baseUrl: string, email: string) {
  await requestJson(baseUrl, '/auth/recovery/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}
export async function resetRecovery(
  baseUrl: string,
  recoveryToken: string,
  newPassword: string,
) {
  await requestJson(baseUrl, '/auth/recovery/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recoveryToken, newPassword }),
  })
}
export async function assistRecovery(
  baseUrl: string,
  schoolId: string,
  userId: string,
) {
  return z
    .object({
      status: z.enum(['requested', 'temporarySetup']),
      recoveryToken: z.string().optional(),
    })
    .parse(
      await requestJson(
        baseUrl,
        `/schools/${encodeURIComponent(schoolId)}/users/${encodeURIComponent(userId)}/assist-recovery`,
        { method: 'POST' },
      ),
    )
}
