import { z } from 'zod'

const anchors: Record<string, string> = {
  'result.published': 'notifications',
  'announcement.published': 'resources-heading',
  'familyMessage.reply': 'family-workspace-heading',
  'support.response': 'support',
  'support.resolved': 'support',
  'support.closed': 'support',
}

export function applicationLinkForNotification(baseUrl: string, type: string) {
  const base = new URL(z.url().parse(baseUrl))
  if (
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && base.hostname === 'localhost')) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw new Error('Invalid public application URL')
  const anchor = type.startsWith('privacy.')
    ? 'privacy'
    : type.startsWith('document.')
      ? 'student-documents-heading'
      : type.startsWith('account.')
        ? 'account-security'
        : (anchors[type] ?? 'notifications')
  base.hash = anchor
  return base.toString()
}
