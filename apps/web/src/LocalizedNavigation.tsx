import { createTranslator, selectLocale } from '@warka/shared'

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

export function LocalizedNavigation({ locale }: { locale?: string | undefined }) {
  const t = createTranslator({ locale: locale ?? browserLocale() })
  return (
    <nav aria-label={t('navigation.label')} className="application-nav">
      {links.map(([key, target]) => (
        <a href={`#${target}`} key={target}>
          {t(key)}
        </a>
      ))}
    </nav>
  )
}
