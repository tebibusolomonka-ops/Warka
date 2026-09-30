import { createTranslator, type TranslationKey } from '@warka/shared'

const translatedStatuses: Record<string, TranslationKey> = {
  pending: 'status.pending',
  approved: 'status.approved',
  draft: 'status.draft',
  published: 'status.published',
  finalized: 'status.finalized',
  absent: 'status.absent',
  present: 'status.present',
}

export function StatusLabel({
  status,
  context,
  locale,
}: {
  status: string
  context?: string
  locale?: string | undefined
}) {
  const key = translatedStatuses[status]
  const label = locale && key ? createTranslator({ locale })(key) : status
  return (
    <span className={`status status-${status}`} data-status={status}>
      {context ? `${context}: ` : ''}
      {label}
    </span>
  )
}
