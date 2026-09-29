import { z } from 'zod'

export const OutboundEmailSchema = z.strictObject({
  to: z.email().max(320),
  subject: z.string().trim().min(1).max(180),
  text: z.string().min(1).max(50_000),
  html: z.string().min(1).max(100_000).optional(),
})

export type OutboundEmail = z.infer<typeof OutboundEmailSchema>
export type EmailProviderHealth = 'available' | 'degraded' | 'unavailable'
export type EmailDeliveryLookup = 'delivered' | 'notDelivered' | 'unknown'
export type EmailSendResult =
  | { status: 'sent'; providerMessageId?: string }
  | {
      status: 'failed'
      failureCode:
        | 'UNAVAILABLE'
        | 'TIMEOUT'
        | 'AMBIGUOUS'
        | 'REJECTED'
        | 'INVALID_RECIPIENT'
      retryable: boolean
    }

export interface EmailProvider {
  send(message: OutboundEmail): Promise<EmailSendResult>
  health(): Promise<EmailProviderHealth>
  lookup?(providerMessageId: string): Promise<EmailDeliveryLookup>
}

export class FakeEmailProvider implements EmailProvider {
  readonly messages: OutboundEmail[] = []
  private readonly outcomes: EmailSendResult[]

  constructor(
    outcomes: EmailSendResult[] = [{ status: 'sent' }],
    private readonly state: EmailProviderHealth = 'available',
  ) {
    this.outcomes = [...outcomes]
  }

  async send(message: OutboundEmail): Promise<EmailSendResult> {
    const parsed = OutboundEmailSchema.parse(message)
    if (this.state === 'unavailable')
      return { status: 'failed', failureCode: 'UNAVAILABLE', retryable: true }
    this.messages.push({ ...parsed })
    return this.outcomes.shift() ?? { status: 'sent' }
  }

  async health(): Promise<EmailProviderHealth> {
    return this.state
  }
}
