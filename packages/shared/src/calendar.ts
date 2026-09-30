import { z } from 'zod'
import { formatDate } from './formatting.js'
import { selectLocale } from './localization.js'

export const CalendarPreferenceSchema = z.enum(['gregorian', 'ethiopian'])
export type CalendarPreference = z.infer<typeof CalendarPreferenceSchema>

const localeTags = { en: 'en-ET', am: 'am-ET', om: 'om-ET' } as const

function valueDate(value: Date | string | number): Date | number {
  return typeof value === 'string' ? new Date(value) : value
}

export function ethiopianDateParts(value: Date | string | number): {
  year: number
  month: number
  day: number
} {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-ethiopic-nu-latn', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(valueDate(value))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value)
  return { year: part('year'), month: part('month'), day: part('day') }
}

export function formatEthiopianDate(
  value: Date | string | number,
  locale: string | null | undefined,
): string {
  const selected = selectLocale(locale)
  return new Intl.DateTimeFormat(`${localeTags[selected]}-u-ca-ethiopic`, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(valueDate(value))
}

export function formatCalendarDate(
  value: Date | string | number,
  locale: string | null | undefined,
  calendar: CalendarPreference,
): string {
  return calendar === 'ethiopian'
    ? formatEthiopianDate(value, locale)
    : formatDate(value, locale, { timeZone: 'UTC' })
}

export function formatAdministrativeDate(
  value: Date | string | number,
  locale: string | null | undefined,
  calendar: CalendarPreference,
): string {
  const selected = formatCalendarDate(value, locale, calendar)
  if (calendar === 'gregorian') return selected
  return `${selected} (${formatDate(value, locale, { timeZone: 'UTC' })} Gregorian)`
}
