import { supportedLocales, type TranslationCatalog } from './localization.js'

export type CatalogEntries = Readonly<
  Record<string, readonly (readonly [string, string])[]>
>

export const criticalTranslationKeys = [
  'navigation.label',
  'navigation.signIn',
  'auth.changePassword',
  'auth.accountRecovery',
  'auth.recoveryNeutral',
  'portal.results',
  'portal.documents',
  'portal.attendance',
  'workflow.reporting',
] as const

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
    .map((match) => match[1]!)
    .sort()
}

export function catalogEntries(
  catalogs: Readonly<Record<string, TranslationCatalog>>,
): CatalogEntries {
  return Object.fromEntries(
    Object.entries(catalogs).map(([locale, catalog]) => [
      locale,
      Object.entries(catalog),
    ]),
  )
}

export function validateTranslationCatalogs(
  entries: CatalogEntries,
  criticalKeys: readonly string[] = criticalTranslationKeys,
): string[] {
  const errors: string[] = []
  const expectedLocales = new Set<string>(supportedLocales)
  const actualLocales = Object.keys(entries)

  for (const locale of actualLocales) {
    if (!expectedLocales.has(locale))
      errors.push(`Unsupported locale identifier: ${locale}`)
  }
  for (const locale of supportedLocales) {
    if (!entries[locale]) errors.push(`Missing locale catalog: ${locale}`)
  }

  const catalogs = new Map<string, Map<string, string>>()
  for (const [locale, rows] of Object.entries(entries)) {
    const catalog = new Map<string, string>()
    for (const [key, value] of rows) {
      if (catalog.has(key)) errors.push(`${locale}: duplicate key ${key}`)
      catalog.set(key, value)
      if (/<\/?[A-Za-z][^>]*>/.test(value))
        errors.push(`${locale}:${key}: HTML markup is not allowed`)
    }
    catalogs.set(locale, catalog)
  }

  const english = catalogs.get('en') ?? new Map<string, string>()
  for (const key of criticalKeys) {
    for (const locale of supportedLocales) {
      if (!catalogs.get(locale)?.has(key))
        errors.push(`${locale}: missing critical key ${key}`)
    }
  }

  for (const locale of supportedLocales.filter((value) => value !== 'en')) {
    const catalog = catalogs.get(locale) ?? new Map<string, string>()
    for (const [key, localized] of catalog) {
      const fallback = english.get(key)
      if (!fallback) {
        errors.push(`${locale}: unknown key ${key}`)
        continue
      }
      const expected = placeholders(fallback)
      const actual = placeholders(localized)
      if (expected.join(',') !== actual.join(',')) {
        errors.push(
          `${locale}:${key}: placeholders [${actual.join(', ')}] do not match English [${expected.join(', ')}]`,
        )
      }
    }
  }
  return errors.sort()
}
