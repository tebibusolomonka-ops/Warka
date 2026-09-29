import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { checkCommunicationSchedulingReadiness } from './communicationSchedulingReadiness.js'

const database = {
  $queryRaw: vi.fn().mockResolvedValue([]),
} as unknown as PrismaClient
const configured = {
  WARKA_EMAIL_OUTBOX_ENABLED: 'true',
  SMTP_HOST: 'smtp.example.test',
  SMTP_USERNAME: 'mailer',
  SMTP_PASSWORD: 'private',
  SMTP_FROM_ADDRESS: 'mail@example.test',
}

describe('communication scheduling readiness', () => {
  it('reports ready only when scheduler, outbox and provider are available', async () => {
    expect(
      await checkCommunicationSchedulingReadiness({
        database,
        env: configured,
        checkOutbox: async () => undefined,
        checkEmail: async () => 'available',
      }),
    ).toEqual({ status: 'ready', reasons: [] })
  })

  it('does not claim reminders run with a disabled scheduler', async () => {
    expect(
      await checkCommunicationSchedulingReadiness({ database, env: {} }),
    ).toEqual({ status: 'disabled', reasons: ['schedulerDisabled'] })
  })

  it('reports missing provider and unavailable outbox without secrets', async () => {
    const result = await checkCommunicationSchedulingReadiness({
      database,
      env: { WARKA_EMAIL_OUTBOX_ENABLED: 'true', SMTP_PASSWORD: 'private' },
      checkOutbox: async () => {
        throw new Error('private connection string')
      },
    })
    expect(result).toEqual({
      status: 'degraded',
      reasons: ['outboxUnavailable', 'emailProviderNotConfigured'],
    })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('reports provider outage', async () => {
    expect(
      await checkCommunicationSchedulingReadiness({
        database,
        env: configured,
        checkOutbox: async () => undefined,
        checkEmail: async () => 'unavailable',
      }),
    ).toEqual({ status: 'degraded', reasons: ['emailProviderUnavailable'] })
  })
})
