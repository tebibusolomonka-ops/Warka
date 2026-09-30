import {
  CalendarPreferenceSchema,
  LanguagePreferenceSchema,
  type CalendarPreference,
  type SupportedLocale,
} from '@warka/shared'
import { requestJson } from './api'

export async function saveLanguagePreference(
  baseUrl: string,
  preferredLocale: SupportedLocale,
): Promise<SupportedLocale> {
  const result = await requestJson(baseUrl, '/me/language-preference', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preferredLocale }),
  })
  return LanguagePreferenceSchema.parse(
    (result as { preferredLocale: unknown }).preferredLocale,
  )
}

export async function saveCalendarPreference(
  baseUrl: string,
  preferredCalendar: CalendarPreference,
): Promise<CalendarPreference> {
  const result = await requestJson(baseUrl, '/me/calendar-preference', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preferredCalendar }),
  })
  return CalendarPreferenceSchema.parse(
    (result as { preferredCalendar: unknown }).preferredCalendar,
  )
}
