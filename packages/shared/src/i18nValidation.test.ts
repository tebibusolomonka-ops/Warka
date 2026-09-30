import { describe, expect, it } from 'vitest'
import {
  validateTranslationCatalogs,
  type CatalogEntries,
} from './i18nValidation.js'

const complete = (overrides: Partial<CatalogEntries> = {}): CatalogEntries => ({
  en: [['critical', 'Hello {name}']],
  am: [['critical', 'ሰላም {name}']],
  om: [['critical', 'Akkam {name}']],
  ...overrides,
})

describe('translation catalog validation', () => {
  it('accepts valid catalogs', () => {
    expect(validateTranslationCatalogs(complete(), ['critical'])).toEqual([])
  })

  it('reports a missing critical key', () => {
    expect(
      validateTranslationCatalogs(complete({ am: [] }), ['critical']),
    ).toContain('am: missing critical key critical')
  })

  it('reports placeholder mismatch and unknown placeholders', () => {
    expect(
      validateTranslationCatalogs(
        complete({ om: [['critical', 'Akkam {person}']] }),
        ['critical'],
      ),
    ).toContain(
      'om:critical: placeholders [person] do not match English [name]',
    )
  })

  it('reports duplicate keys', () => {
    expect(
      validateTranslationCatalogs(
        complete({
          am: [
            ['critical', 'ሰላም {name}'],
            ['critical', 'ሰላም {name}'],
          ],
        }),
        ['critical'],
      ),
    ).toContain('am: duplicate key critical')
  })

  it('allows a non-critical key to use English fallback', () => {
    const entries = complete({
      en: [
        ['critical', 'Hello {name}'],
        ['optional', 'Optional'],
      ],
    })
    expect(validateTranslationCatalogs(entries, ['critical'])).toEqual([])
  })
})
