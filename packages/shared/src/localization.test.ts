import { describe, expect, it } from 'vitest'
import {
  createTranslator,
  selectLocale,
  translate,
  type TranslationCatalog,
} from './localization.js'

describe('localization', () => {
  it('selects supported language tags and falls back for unsupported locales', () => {
    expect(selectLocale('am-ET')).toBe('am')
    expect(selectLocale('om_ET')).toBe('om')
    expect(selectLocale('fr')).toBe('en')
    expect(selectLocale(undefined)).toBe('en')
  })

  it('uses the complete English catalog when a localized entry is absent', () => {
    const t = createTranslator({
      locale: 'am',
      catalogs: { am: {}, en: { 'common.save': 'Save' } },
    })
    expect(t('common.save')).toBe('Save')
  })

  it('makes a missing key detectable outside production', () => {
    const catalogs = { en: {} as TranslationCatalog }
    expect(
      createTranslator({ locale: 'om', mode: 'test', catalogs })('common.save'),
    ).toBe('[[missing:om:common.save]]')
  })

  it('interpolates named values without interpreting markup', () => {
    expect(translate('en', 'common.greeting', { name: '<b>Abel</b>' })).toBe(
      'Hello, <b>Abel</b>',
    )
  })

  it('leaves an omitted placeholder visible', () => {
    expect(translate('om', 'common.greeting')).toBe('Akkam, {name}')
  })
})
