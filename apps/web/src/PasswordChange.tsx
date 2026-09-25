import { useState, type FormEvent } from 'react'
import { ApiError, changePassword } from './api'

export function PasswordChange({
  baseUrl,
  onChanged,
  onSignOut,
}: {
  baseUrl: string
  onChanged: () => Promise<void>
  onSignOut: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 12 || newPassword !== confirmation) {
      setError('Use at least 12 characters and confirm the new password.')
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
          ? 'Current password is incorrect.'
          : 'Could not change password. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="password-change-heading">
      <div className="account">
        <h2 id="password-change-heading">Change your password</h2>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <p>Choose a new password to continue.</p>
      <form onSubmit={submit}>
        <label className="field">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label className="field">
          New password
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
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Changing password' : 'Change password'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
