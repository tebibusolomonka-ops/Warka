import { useEffect, useState, type FormEvent } from 'react'
import { changePassword } from './api'
import {
  assistRecovery,
  getOwnSessions,
  revokeOtherSessions,
  revokeOwnSession,
  type SafeSession,
} from './securityApi'

export function AccountSecurity({ baseUrl }: { baseUrl: string }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<SafeSession[]>([])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (open)
      void getOwnSessions(baseUrl)
        .then(setSessions)
        .catch(() => setMessage('Could not load sessions'))
  }, [open, baseUrl])
  async function change(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 12 || newPassword !== confirmation) {
      setMessage('Confirm a password of at least 12 characters')
      return
    }
    try {
      await changePassword(baseUrl, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setMessage('Password changed')
      setSessions(await getOwnSessions(baseUrl))
    } catch {
      setMessage('Could not change password')
    }
  }
  return (
    <section aria-label="Account security">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Account security
      </button>
      {open && (
        <>
          <h2>Account security</h2>
          <form onSubmit={(event) => void change(event)}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </label>
            <button type="submit">Change password</button>
          </form>
          <h3>Active sessions</h3>
          <ul>
            {sessions.map((session) => (
              <li key={session.managementId}>
                Created {new Date(session.createdAt).toLocaleString()} � Expires{' '}
                {new Date(session.expiresAt).toLocaleString()}{' '}
                {session.current ? '� Current session' : ''}
                {!session.current && (
                  <button
                    type="button"
                    onClick={() =>
                      void revokeOwnSession(baseUrl, session.managementId)
                        .then(async () =>
                          setSessions(await getOwnSessions(baseUrl)),
                        )
                        .catch(() => setMessage('Could not revoke session'))
                    }
                  >
                    Revoke session
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              void revokeOtherSessions(baseUrl)
                .then(async () => {
                  setSessions(await getOwnSessions(baseUrl))
                  setMessage('Other sessions revoked')
                })
                .catch(() => setMessage('Could not revoke sessions'))
            }
          >
            Revoke all other sessions
          </button>
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  )
}

export function AdminRecovery({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [targetUserId, setTargetUserId] = useState('')
  const [message, setMessage] = useState('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void assistRecovery(baseUrl, schoolId, targetUserId)
          .then(() => setMessage('Recovery initiated'))
          .catch(() => setMessage('Could not initiate recovery'))
      }}
    >
      <h3>Assist account recovery</h3>
      <label>
        User ID
        <input
          value={targetUserId}
          onChange={(event) => setTargetUserId(event.target.value)}
          required
        />
      </label>
      <button type="submit">Initiate recovery</button>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
