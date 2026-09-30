import { useEffect, useState, type FormEvent } from 'react'
import { changePassword } from './api'
import { createTranslator, formatDateTime } from '@warka/shared'
import { browserLocale } from './LocalizedNavigation'
import {
  assistRecovery,
  getOwnSessions,
  revokeOtherSessions,
  revokeOwnSession,
  type SafeSession,
} from './securityApi'

export function AccountSecurity({
  baseUrl,
  locale,
}: {
  baseUrl: string
  locale?: string | undefined
}) {
  const t = createTranslator({ locale: locale ?? browserLocale() })
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
        .catch(() => setMessage(t('auth.sessionsLoadFailed')))
  }, [open, baseUrl])
  async function change(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 12 || newPassword !== confirmation) {
      setMessage(t('auth.passwordValidation'))
      return
    }
    try {
      await changePassword(baseUrl, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setMessage(t('auth.passwordChanged'))
      setSessions(await getOwnSessions(baseUrl))
    } catch {
      setMessage(t('auth.passwordChangeFailed'))
    }
  }
  return (
    <section id="account-security" aria-label={t('auth.accountSecurity')}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('auth.accountSecurity')}
      </button>
      {open && (
        <>
          <h2>{t('auth.accountSecurity')}</h2>
          <form onSubmit={(event) => void change(event)}>
            <label>
              {t('auth.currentPassword')}
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              {t('auth.newPassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              {t('auth.confirmPassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </label>
            <button type="submit">{t('auth.changePassword')}</button>
          </form>
          <h3>{t('auth.activeSessions')}</h3>
          <ul>
            {sessions.map((session) => (
              <li key={session.managementId}>
                {t('auth.created')} {formatDateTime(session.createdAt, locale)}{' '}
                · {t('auth.expires')}{' '}
                {formatDateTime(session.expiresAt, locale)}{' '}
                {session.current ? `· ${t('auth.currentSession')}` : ''}
                {!session.current && (
                  <button
                    type="button"
                    onClick={() =>
                      void revokeOwnSession(baseUrl, session.managementId)
                        .then(async () =>
                          setSessions(await getOwnSessions(baseUrl)),
                        )
                        .catch(() => setMessage(t('auth.sessionRevokeFailed')))
                    }
                  >
                    {t('auth.revokeSession')}
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
            {t('auth.revokeOthers')}
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
  const [temporaryToken, setTemporaryToken] = useState('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setTemporaryToken('')
        void assistRecovery(baseUrl, schoolId, targetUserId)
          .then((result) => {
            setTemporaryToken(result.recoveryToken ?? '')
            setMessage(
              result.status === 'temporarySetup'
                ? 'Temporary recovery setup issued. Share it securely with the account owner.'
                : 'Recovery initiated',
            )
          })
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
      {temporaryToken && (
        <label>
          Temporary recovery token
          <input readOnly value={temporaryToken} />
        </label>
      )}
    </form>
  )
}
