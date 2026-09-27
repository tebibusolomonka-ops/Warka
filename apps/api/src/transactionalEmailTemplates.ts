import { z } from 'zod'
import type { OutboundEmail } from './emailProvider.js'

const NameSchema = z.string().trim().min(1).max(120)
const AddressSchema = z.email().max(320)
const RecoveryUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && url.hostname === 'localhost')
  )
})

export type TransactionalEmailInput =
  | {
      templateKey: 'accountRecovery'
      to: string
      displayName: string
      recoveryUrl: string
    }
  | {
      templateKey: 'passwordChanged' | 'accountSuspended' | 'accountReactivated'
      to: string
      displayName: string
    }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

export function renderTransactionalEmail(
  input: TransactionalEmailInput,
): OutboundEmail {
  const to = AddressSchema.parse(input.to)
  const displayName = NameSchema.parse(input.displayName)
  const safeName = escapeHtml(displayName)
  const greeting = `Hello ${displayName},`
  let subject: string
  let text: string
  let html: string

  switch (input.templateKey) {
    case 'accountRecovery': {
      const recoveryUrl = RecoveryUrlSchema.parse(input.recoveryUrl)
      subject = 'Reset your Warka password'
      text = `${greeting}\n\nUse this link to reset your Warka password: ${recoveryUrl}\n\nIf you did not request this, ignore this email.`
      html = `<p>Hello ${safeName},</p><p>Use this link to reset your Warka password: <a href="${escapeHtml(recoveryUrl)}">Reset password</a>.</p><p>If you did not request this, ignore this email.</p>`
      break
    }
    case 'passwordChanged':
      subject = 'Your Warka password changed'
      text = `${greeting}\n\nYour Warka password was changed. If this was not you, contact your school administrator.`
      html = `<p>Hello ${safeName},</p><p>Your Warka password was changed. If this was not you, contact your school administrator.</p>`
      break
    case 'accountSuspended':
      subject = 'Your Warka account was suspended'
      text = `${greeting}\n\nYour Warka account was suspended. Contact your school administrator for help.`
      html = `<p>Hello ${safeName},</p><p>Your Warka account was suspended. Contact your school administrator for help.</p>`
      break
    case 'accountReactivated':
      subject = 'Your Warka account was reactivated'
      text = `${greeting}\n\nYour Warka account was reactivated. You may sign in again.`
      html = `<p>Hello ${safeName},</p><p>Your Warka account was reactivated. You may sign in again.</p>`
      break
  }
  return { to, subject, text, html }
}
