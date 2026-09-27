import { describe, expect, it } from 'vitest'
import { FakeEmailProvider, OutboundEmailSchema } from './emailProvider.js'

const message = {
  to: 'recipient@example.test',
  subject: 'Warka account update',
  text: 'Your account has changed.',
}

describe('email provider contract', () => {
  it('captures structured messages without network calls', async () => {
    const provider = new FakeEmailProvider([
      { status: 'sent', providerMessageId: 'controlled-id' },
      { status: 'failed', failureCode: 'REJECTED', retryable: false },
    ])
    expect(await provider.health()).toBe('available')
    expect(await provider.send(message)).toEqual({
      status: 'sent',
      providerMessageId: 'controlled-id',
    })
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'REJECTED',
      retryable: false,
    })
    expect(provider.messages).toEqual([message, message])
  })

  it('does not capture a message when unavailable and validates input', async () => {
    const provider = new FakeEmailProvider([], 'unavailable')
    expect(await provider.send(message)).toEqual({
      status: 'failed',
      failureCode: 'UNAVAILABLE',
      retryable: true,
    })
    expect(provider.messages).toEqual([])
    expect(() =>
      OutboundEmailSchema.parse({ ...message, arbitraryHtml: '<b>unsafe</b>' }),
    ).toThrow()
  })
})
