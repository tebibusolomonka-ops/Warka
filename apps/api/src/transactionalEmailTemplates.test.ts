import { describe, expect, it } from 'vitest'
import { renderTransactionalEmail } from './transactionalEmailTemplates.js'

describe('transactional email templates', () => {
  it('renders recovery content in memory with escaped HTML', () => {
    const email = renderTransactionalEmail({
      templateKey: 'accountRecovery',
      to: 'recipient@example.test',
      displayName: '<A&B>',
      recoveryUrl: 'https://warka.example.test/reset?token=secret&next=home',
    })
    expect(email.text).toContain('token=secret')
    expect(email.html).toContain('Hello &lt;A&amp;B&gt;')
    expect(email.html).toContain('token=secret&amp;next=home')
    expect(email.html).not.toContain('<A&B>')
  })

  it('rejects unsafe recovery URLs and unsolicited fields', () => {
    expect(() =>
      renderTransactionalEmail({
        templateKey: 'accountRecovery',
        to: 'recipient@example.test',
        displayName: 'User',
        recoveryUrl: 'javascript:alert(1)',
      }),
    ).toThrow()
  })

  it.each([
    'passwordChanged',
    'accountSuspended',
    'accountReactivated',
    'notificationUpdate',
  ] as const)('renders %s as text and safe HTML', (templateKey) => {
    const email = renderTransactionalEmail({
      templateKey,
      to: 'recipient@example.test',
      displayName: 'User',
    })
    expect(email.text).toContain('Hello User,')
    expect(email.html).toContain('<p>Hello User,</p>')
    expect(email.html).not.toContain('<script')
  })
})
