import type { PrismaClient } from '@warka/database'
import { configuredEmailProvider } from './emailOutboxScheduler.js'
import type { EmailProviderHealth } from './emailProvider.js'

export type CommunicationSchedulingReadiness = {
  status: 'ready' | 'degraded' | 'disabled'
  reasons: Array<
    | 'schedulerDisabled'
    | 'outboxUnavailable'
    | 'emailProviderNotConfigured'
    | 'emailProviderUnavailable'
  >
}

export async function checkCommunicationSchedulingReadiness(input: {
  database: Pick<PrismaClient, '$queryRaw'>
  env?: NodeJS.ProcessEnv
  checkOutbox?: () => Promise<void>
  checkEmail?: () => Promise<EmailProviderHealth>
}): Promise<CommunicationSchedulingReadiness> {
  const env = input.env ?? process.env
  if (env.WARKA_EMAIL_OUTBOX_ENABLED !== 'true')
    return { status: 'disabled', reasons: ['schedulerDisabled'] }

  const reasons: CommunicationSchedulingReadiness['reasons'] = []
  try {
    await (
      input.checkOutbox ??
      (async () => {
        await input.database.$queryRaw`SELECT 1 FROM "EmailDelivery" LIMIT 1`
      })
    )()
  } catch {
    reasons.push('outboxUnavailable')
  }
  if (
    !env.SMTP_HOST ||
    !env.SMTP_USERNAME ||
    !env.SMTP_PASSWORD ||
    !env.SMTP_FROM_ADDRESS
  )
    reasons.push('emailProviderNotConfigured')
  else {
    try {
      const state = await (
        input.checkEmail ?? (() => configuredEmailProvider(env).health())
      )()
      if (state !== 'available') reasons.push('emailProviderUnavailable')
    } catch {
      reasons.push('emailProviderUnavailable')
    }
  }
  return { status: reasons.length ? 'degraded' : 'ready', reasons }
}
