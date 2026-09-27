import nodemailer, { type Transporter } from 'nodemailer'
import { z } from 'zod'
import type {
  EmailProvider,
  EmailProviderHealth,
  EmailSendResult,
  OutboundEmail,
} from './emailProvider.js'
import { OutboundEmailSchema } from './emailProvider.js'

const SmtpConfigurationSchema = z.strictObject({
  host: z.string().trim().min(1).max(253),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1).max(320),
  password: z.string().min(1),
  fromAddress: z.email().max(320),
  fromName: z.string().trim().min(1).max(120),
  timeoutMs: z.number().int().min(100).max(30000),
})

export type SmtpConfiguration = z.infer<typeof SmtpConfigurationSchema>

export function smtpConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return SmtpConfigurationSchema.parse({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure:
      z.enum(['true', 'false']).parse(env.SMTP_SECURE ?? 'false') === 'true',
    username: env.SMTP_USERNAME,
    password: env.SMTP_PASSWORD,
    fromAddress: env.SMTP_FROM_ADDRESS,
    fromName: env.SMTP_FROM_NAME,
    timeoutMs: Number(env.SMTP_TIMEOUT_MS ?? 5000),
  })
}

type MailTransport = Pick<Transporter, 'sendMail' | 'verify'>

function failure(error: unknown): EmailSendResult {
  const value = error as { code?: unknown; responseCode?: unknown }
  const code = typeof value?.code === 'string' ? value.code : ''
  const responseCode =
    typeof value?.responseCode === 'number' ? value.responseCode : 0
  if (code === 'ETIMEDOUT' || code === 'ESOCKET')
    return { status: 'failed', failureCode: 'TIMEOUT', retryable: false }
  if (code === 'EENVELOPE' || responseCode === 550 || responseCode === 553)
    return {
      status: 'failed',
      failureCode: 'INVALID_RECIPIENT',
      retryable: false,
    }
  if (code === 'EAUTH' || responseCode >= 500)
    return { status: 'failed', failureCode: 'REJECTED', retryable: false }
  if (
    ['ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND'].includes(code) ||
    (responseCode >= 400 && responseCode < 500)
  )
    return { status: 'failed', failureCode: 'UNAVAILABLE', retryable: true }
  return { status: 'failed', failureCode: 'AMBIGUOUS', retryable: false }
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly configuration: SmtpConfiguration
  private readonly transport: MailTransport

  constructor(configuration: SmtpConfiguration, transport?: MailTransport) {
    this.configuration = SmtpConfigurationSchema.parse(configuration)
    this.transport =
      transport ??
      nodemailer.createTransport({
        host: this.configuration.host,
        port: this.configuration.port,
        secure: this.configuration.secure,
        auth: {
          user: this.configuration.username,
          pass: this.configuration.password,
        },
        connectionTimeout: this.configuration.timeoutMs,
        greetingTimeout: this.configuration.timeoutMs,
        socketTimeout: this.configuration.timeoutMs,
      })
  }

  async send(message: OutboundEmail): Promise<EmailSendResult> {
    const parsed = OutboundEmailSchema.parse(message)
    try {
      const sent = await this.transport.sendMail({
        from: {
          name: this.configuration.fromName,
          address: this.configuration.fromAddress,
        },
        to: parsed.to,
        subject: parsed.subject,
        text: parsed.text,
        ...(parsed.html ? { html: parsed.html } : {}),
      })
      return {
        status: 'sent',
        ...(sent.messageId
          ? { providerMessageId: sent.messageId.slice(0, 255) }
          : {}),
      }
    } catch (error) {
      return failure(error)
    }
  }

  async health(): Promise<EmailProviderHealth> {
    try {
      await this.transport.verify()
      return 'available'
    } catch {
      return 'unavailable'
    }
  }
}
