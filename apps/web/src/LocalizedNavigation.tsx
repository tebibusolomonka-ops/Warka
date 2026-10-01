import { createTranslator, selectLocale } from '@warka/shared'
import { MobileNavigation } from './MobileNavigation'

const links = [
  ['navigation.account', 'account'],
  ['navigation.security', 'security'],
  ['navigation.notifications', 'notifications'],
  ['navigation.search', 'global-search'],
  ['navigation.students', 'students'],
  ['navigation.academics', 'academics'],
  ['navigation.documents', 'documents'],
  ['navigation.reporting', 'reporting'],
  ['navigation.operations', 'operations'],
  ['navigation.support', 'support'],
  ['navigation.settings', 'settings'],
] as const

export function browserLocale(): 'en' | 'am' | 'om' {
  return selectLocale(
    typeof navigator === 'undefined' ? undefined : navigator.language,
  )
}

export function LocalizedNavigation({
  locale,
}: {
  locale?: string | undefined
}) {
  const t = createTranslator({ locale: locale ?? browserLocale() })
  const navigationLinks = links.map(([key, target]) => (
    <a href={`#${target}`} key={target}>
      {t(key)}
    </a>
  ))
  return (
    <>
      <nav
        aria-label={t('navigation.label')}
        className="application-nav desktop-navigation"
      >
        {navigationLinks}
      </nav>
      <MobileNavigation label={t('navigation.label')}>
        <nav aria-label={t('navigation.label')}>{navigationLinks}</nav>
      </MobileNavigation>
    </>
  )
}
