import { useState, type FormEvent } from 'react'
import { ApiError, changePassword } from './api'
import { createTranslator } from '@warka/shared'
import { browserLocale } from './LocalizedNavigation'

export function PasswordChange({
  baseUrl,
  onChanged,
  onSignOut,
  locale,
}: {
  baseUrl: string
  onChanged: () => Promise<void>
  onSignOut: () => void
  locale?: string | undefined
}) {
  const t = createTranslator({ locale: locale ?? browserLocale() })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 12 || newPassword !== confirmation) {
      setError(t('auth.passwordValidation'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await changePassword(baseUrl, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      await onChanged()
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === 'INVALID_CURRENT_PASSWORD'
          ? t('auth.currentPasswordIncorrect')
          : t('auth.passwordChangeFailed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="password-change-heading">
      <div className="account">
        <h2 id="password-change-heading">{t('auth.changePasswordHeading')}</h2>
        <button type="button" onClick={onSignOut}>
          {t('navigation.signOut')}
        </button>
      </div>
      <p>{t('auth.changePasswordPrompt')}</p>
      <form onSubmit={submit}>
        <label className="field">
          {t('auth.currentPassword')}
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label className="field">
          {t('auth.newPassword')}
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={12}
          />
        </label>
        <label className="field">
          {t('auth.confirmPassword')}
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? t('auth.changingPassword') : t('auth.changePassword')}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
