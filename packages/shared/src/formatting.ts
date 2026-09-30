import { selectLocale, type SupportedLocale } from './localization.js'

const intlLocales: Record<SupportedLocale, string> = {
  en: 'en-ET',
  am: 'am-ET',
  om: 'om-ET',
}

export interface DateFormattingOptions extends Omit<
  Intl.DateTimeFormatOptions,
  'timeZone'
> {
  timeZone?: string | undefined
}

function intlLocale(locale: string | null | undefined): string {
  return intlLocales[selectLocale(locale)]
}

function dateValue(value: Date | string | number): Date | number {
  return typeof value === 'string' ? new Date(value) : value
}

export function formatDate(
  value: Date | string | number,
  locale: string | null | undefined,
  options: DateFormattingOptions = {},
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(dateValue(value))
}

export function formatTime(
  value: Date | string | number,
  locale: string | null | undefined,
  options: DateFormattingOptions = {},
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(dateValue(value))
}

export function formatDateTime(
  value: Date | string | number,
  locale: string | null | undefined,
  options: DateFormattingOptions = {},
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(dateValue(value))
}

export function formatNumber(
  value: number,
  locale: string | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value)
}

export function formatPercentage(
  value: number,
  locale: string | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 2,
    ...options,
  }).format(value / 100)
}

export function formatFileSize(
  bytes: number | bigint,
  locale: string | null | undefined,
): string {
  const numeric = typeof bytes === 'bigint' ? Number(bytes) : bytes
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  const unitIndex = Math.min(
    Math.max(0, Math.floor(Math.log(Math.max(numeric, 1)) / Math.log(1024))),
    units.length - 1,
  )
  const amount = numeric / 1024 ** unitIndex
  return `${formatNumber(amount, locale, { maximumFractionDigits: unitIndex ? 1 : 0 })} ${units[unitIndex]}`
}
