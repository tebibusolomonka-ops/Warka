import { describe, expect, it } from 'vitest'
import { applicationLinkForNotification } from './notificationLinks.js'
import { renderTransactionalEmail } from './transactionalEmailTemplates.js'

describe('notification application links', () => {
  it('uses fixed authenticated workspace anchors without resource identifiers', () => {
    const base = 'https://warka.example.test/'
    expect(applicationLinkForNotification(base, 'result.published')).toBe(
      `${base}#notifications`,
    )
    expect(applicationLinkForNotification(base, 'familyMessage.reply')).toBe(
      `${base}#family-workspace-heading`,
    )
    expect(applicationLinkForNotification(base, 'support.response')).toBe(
      `${base}#support`,
    )
    expect(applicationLinkForNotification(base, 'privacy.fulfilled')).toBe(
      `${base}#privacy`,
    )
    expect(
      applicationLinkForNotification(base, 'unknown?next=https://evil.test'),
    ).toBe(`${base}#notifications`)
  })

  it('rejects malformed or redirected bases and renders an escaped link', () => {
    expect(() =>
      applicationLinkForNotification('javascript:alert(1)', 'support.response'),
    ).toThrow()
    expect(() =>
      applicationLinkForNotification(
        'https://warka.example.test/?next=https://evil.test',
        'support.response',
      ),
    ).toThrow()
    const email = renderTransactionalEmail({
      templateKey: 'notificationUpdate',
      to: 'recipient@example.test',
      displayName: '<Recipient>',
      applicationUrl: applicationLinkForNotification(
        'https://warka.example.test/',
        'support.response',
      ),
    })
    expect(email.text).toContain('https://warka.example.test/#support')
    expect(email.html).toContain('Hello &lt;Recipient&gt;')
    expect(email.html).not.toContain('<Recipient>')
  })
})
