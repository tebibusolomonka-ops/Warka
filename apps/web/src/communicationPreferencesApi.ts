import { z } from 'zod'
import { requestJson } from './api'

const category = z.enum([
  'accountSecurity',
  'academicResults',
  'schoolAnnouncements',
  'learningMaterials',
  'documents',
  'familyCommunication',
  'reporting',
  'support',
  'privacy',
])
const preference = z.object({
  category,
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  digestCadence: z.enum(['off', 'daily', 'weekly']),
})
const response = z.object({ preferences: z.array(preference) })

export type CommunicationPreference = z.infer<typeof preference>

export async function getCommunicationPreferences(baseUrl: string) {
  return response.parse(
    await requestJson(baseUrl, '/me/notification-preferences'),
  ).preferences
}

export async function putCommunicationPreference(
  baseUrl: string,
  value: CommunicationPreference,
) {
  return response.parse(
    await requestJson(
      baseUrl,
      `/me/notification-preferences/${encodeURIComponent(value.category)}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inAppEnabled: value.inAppEnabled,
          emailEnabled: value.emailEnabled,
          digestCadence: value.digestCadence,
        }),
      },
    ),
  ).preferences
}
