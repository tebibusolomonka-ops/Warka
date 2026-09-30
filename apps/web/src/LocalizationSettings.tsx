import {
  createTranslator,
  supportedLocales,
  type CalendarPreference,
  type SupportedLocale,
} from '@warka/shared'
import {
  saveCalendarPreference,
  saveLanguagePreference,
} from './localizationApi'

export function LocalizationSettings({
  baseUrl,
  locale,
  calendar,
  onLocaleChanged,
  onCalendarChanged,
}: {
  baseUrl: string
  locale: SupportedLocale
  calendar: CalendarPreference
  onLocaleChanged: (locale: SupportedLocale) => void
  onCalendarChanged: (calendar: CalendarPreference) => void
}) {
  const t = createTranslator({ locale })
  return (
    <section id="settings" aria-label={t('settings.localization')}>
      <label>
        {t('settings.language')}
        <select
          data-testid="language-preference"
          value={locale}
          onChange={(event) => {
            const selected = event.target.value as SupportedLocale
            void saveLanguagePreference(baseUrl, selected).then(onLocaleChanged)
          }}
        >
          {supportedLocales.map((value) => (
            <option key={value} value={value}>
              {t(
                value === 'en'
                  ? 'locale.english'
                  : value === 'am'
                    ? 'locale.amharic'
                    : 'locale.oromo',
              )}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('settings.calendar')}
        <select
          data-testid="calendar-preference"
          value={calendar}
          onChange={(event) => {
            const selected = event.target.value as CalendarPreference
            void saveCalendarPreference(baseUrl, selected).then(
              onCalendarChanged,
            )
          }}
        >
          <option value="gregorian">{t('settings.gregorian')}</option>
          <option value="ethiopian">{t('settings.ethiopian')}</option>
        </select>
      </label>
    </section>
  )
}
