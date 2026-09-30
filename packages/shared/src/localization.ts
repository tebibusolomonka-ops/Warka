import { z } from 'zod'

export const supportedLocales = ['en', 'am', 'om'] as const

export type SupportedLocale = (typeof supportedLocales)[number]
export type TranslationCatalog = Readonly<Record<string, string>>
export type TranslationValues = Readonly<Record<string, string | number>>

export const defaultLocale: SupportedLocale = 'en'

export const LanguagePreferenceSchema = z.enum(supportedLocales)
export const LanguagePreferenceResponseSchema = z.strictObject({
  preferredLocale: LanguagePreferenceSchema,
})

const englishCatalog = {
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.save': 'Save',
  'common.loading': 'Loading',
  'common.greeting': 'Hello, {name}',
  'locale.english': 'English',
  'locale.amharic': 'Amharic',
  'locale.oromo': 'Oromo',
} as const satisfies TranslationCatalog

export type TranslationKey = keyof typeof englishCatalog

const amharicCatalog: Partial<Record<TranslationKey, string>> = {
  'common.cancel': 'ይቅር',
  'common.continue': 'ቀጥል',
  'common.save': 'አስቀምጥ',
  'common.loading': 'በመጫን ላይ',
  'common.greeting': 'ሰላም፣ {name}',
  'locale.english': 'እንግሊዝኛ',
  'locale.amharic': 'አማርኛ',
  'locale.oromo': 'ኦሮምኛ',
}

const oromoCatalog: Partial<Record<TranslationKey, string>> = {
  'common.cancel': 'Dhiisi',
  'common.continue': 'Itti fufi',
  'common.save': 'Olkaa’i',
  'common.loading': 'Fe’amaa jira',
  'common.greeting': 'Akkam, {name}',
  'locale.english': 'Afaan Ingilizii',
  'locale.amharic': 'Afaan Amaaraa',
  'locale.oromo': 'Afaan Oromoo',
}

export const translationCatalogs: Readonly<
  Record<SupportedLocale, TranslationCatalog>
> = {
  en: englishCatalog,
  am: amharicCatalog,
  om: oromoCatalog,
}

export function selectLocale(locale: string | null | undefined): SupportedLocale {
  if (!locale) return defaultLocale

  const normalized = locale.trim().toLowerCase().replace('_', '-').split('-')[0]
  return supportedLocales.find((candidate) => candidate === normalized) ?? defaultLocale
}

function interpolate(template: string, values: TranslationValues): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    const value = values[name]
    return value === undefined ? placeholder : String(value)
  })
}

export interface TranslatorOptions {
  locale?: string | null
  mode?: 'development' | 'test' | 'production'
  catalogs?: Partial<Record<SupportedLocale, TranslationCatalog>>
}

export function createTranslator(options: TranslatorOptions = {}) {
  const locale = selectLocale(options.locale)
  const catalogs = options.catalogs ?? translationCatalogs

  return (key: TranslationKey, values: TranslationValues = {}): string => {
    const localized = catalogs[locale]?.[key]
    const fallback = catalogs.en?.[key]
    const template = localized ?? fallback

    if (!template) {
      return options.mode === 'production' ? key : `[[missing:${locale}:${key}]]`
    }

    return interpolate(template, values)
  }
}

export function translate(
  locale: string | null | undefined,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  return createTranslator({ locale: locale ?? null })(key, values)
}
