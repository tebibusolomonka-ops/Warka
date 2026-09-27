import { describe, expect, it, vi } from 'vitest'
import { SmtpEmailProvider, smtpConfiguration } from './smtpEmailProvider.js'

const configuration = {
  host: 'smtp.example.test',
  port: 587,
  secure: false,
  username: 'warka@example.test',
  password: 'fixture-password',
  fromAddress: 'warka@example.test',
  fromName: 'Warka',
  timeoutMs: 5000,
}

const message = {
  to: 'recipient@example.test',
  subject: 'Account update',
  text: 'Your account changed.',
}

describe('SMTP email provider', () => {
  it('validates server configuration without exposing credentials', () => {
    expect(
      smtpConfiguration({
        SMTP_HOST: configuration.host,
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USERNAME: configuration.username,
        SMTP_PASSWORD: configuration.password,
        SMTP_FROM_ADDRESS: configuration.fromAddress,
        SMTP_FROM_NAME: configuration.fromName,
      }),
    ).toEqual(configuration)
    expect(() => smtpConfiguration({ SMTP_PORT: '0' })).toThrow()
  })

  it('sends through an injected transport and maps safe results', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'provider-id' })
    const verify = vi.fn().mockResolvedValue(true)
    const provider = new SmtpEmailProvider(configuration, {
      sendMail,
      verify,
    } as never)
    expect(await provider.health()).toBe('available')
    expect(await provider.send(message)).toEqual({
      status: 'sent',
      providerMessageId: 'provider-id',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Warka', address: 'warka@example.test' },
        to: message.to,
        text: message.text,
      }),
    )
  })

  it('maps authentication, recipient, and connection failures', async () => {
    const sendMail = vi.fn()
    const verify = vi.fn().mockRejectedValue(new Error('hidden host'))
    const provider = new SmtpEmailProvider(configuration, {
      sendMail,
      verify,
    } as never)
    expect(await provider.health()).toBe('unavailable')
    sendMail.mockRejectedValueOnce({ code: 'EAUTH', message: 'secret' })
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'REJECTED',
      retryable: false,
    })
    sendMail.mockRejectedValueOnce({ responseCode: 550 })
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'INVALID_RECIPIENT',
      retryable: false,
    })
    sendMail.mockRejectedValueOnce({ code: 'ETIMEDOUT' })
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'TIMEOUT',
      retryable: false,
    })
    sendMail.mockRejectedValueOnce({ code: 'ECONNECTION' })
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'UNAVAILABLE',
      retryable: true,
    })
    sendMail.mockRejectedValueOnce(new Error('unknown outcome'))
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'AMBIGUOUS',
      retryable: false,
    })
  })
})
