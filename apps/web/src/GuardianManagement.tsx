import { useEffect, useState, type FormEvent } from 'react'
import type { GuardianRelationshipView } from '@warka/shared'
import { ApiError } from './api'
import {
  getGuardianRelationships,
  provisionGuardianAccount,
  revokeGuardian,
  verifyGuardian,
} from './parentApi'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: GuardianRelationshipView[] }

export function GuardianManagement({
  baseUrl,
  schoolId,
  studentId,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  studentId: string
  onSessionExpired: () => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [revokeFor, setRevokeFor] = useState('')
  const [reason, setReason] = useState('')
  const [provisionFor, setProvisionFor] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [initialPassword, setInitialPassword] = useState('')

  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
    else
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Could not update guardian access.',
      )
  }
  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    getGuardianRelationships(baseUrl, schoolId, studentId)
      .then((data) => {
        if (active) setLoad({ status: 'loaded', data })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setLoad({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, studentId, refresh, onSessionExpired])

  async function verify(item: GuardianRelationshipView) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await verifyGuardian(baseUrl, schoolId, studentId, item.guardianId)
      setMessage(`${item.name} relationship verified.`)
      setRefresh((value) => value + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }
  async function revoke(
    event: FormEvent<HTMLFormElement>,
    item: GuardianRelationshipView,
  ) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await revokeGuardian(
        baseUrl,
        schoolId,
        studentId,
        item.guardianId,
        reason,
      )
      setReason('')
      setRevokeFor('')
      setMessage(`${item.name} relationship revoked.`)
      setRefresh((value) => value + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }
  async function provision(
    event: FormEvent<HTMLFormElement>,
    item: GuardianRelationshipView,
  ) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await provisionGuardianAccount(baseUrl, schoolId, {
        guardianId: item.guardianId,
        email,
        displayName,
        initialPassword,
      })
      setInitialPassword('')
      setEmail('')
      setDisplayName('')
      setProvisionFor('')
      setMessage(
        `${item.name} account created. Password change required at first login.`,
      )
      setRefresh((value) => value + 1)
    } catch (cause) {
      setInitialPassword('')
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="academic-panel"
      aria-labelledby="guardian-management-heading"
    >
      <h4 id="guardian-management-heading">Guardian portal access</h4>
      {load.status === 'loading' && (
        <p role="status">Loading guardian relationships</p>
      )}
      {load.status === 'error' && (
        <div role="alert">
          <p>Could not load guardian relationships.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {load.status === 'loaded' && load.data.length === 0 && (
        <p>No guardian relationships recorded.</p>
      )}
      {load.status === 'loaded' && (
        <ul className="guardian-list">
          {load.data.map((item) => (
            <li key={item.guardianId}>
              <strong>{item.name}</strong> - {item.relationship} -{' '}
              <span className={'status status-' + item.verificationStatus}>
                {item.verificationStatus}
              </span>
              <p>
                {item.account
                  ? `Portal account: ${item.account.displayName} (${item.account.email})`
                  : 'No portal account'}
              </p>
              {item.verificationStatus !== 'verified' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void verify(item)}
                >
                  Verify relationship for {item.name}
                </button>
              )}
              {item.verificationStatus === 'verified' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRevokeFor(item.guardianId)}
                  >
                    Revoke relationship for {item.name}
                  </button>
                  {revokeFor === item.guardianId && (
                    <form onSubmit={(event) => void revoke(event, item)}>
                      <label className="field">
                        Revocation reason
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          required
                          maxLength={500}
                        />
                      </label>
                      <button type="submit" disabled={busy || !reason.trim()}>
                        Confirm revocation
                      </button>
                    </form>
                  )}
                  {!item.account && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setProvisionFor(item.guardianId)
                          setDisplayName(item.name)
                        }}
                      >
                        Provision portal account for {item.name}
                      </button>
                      {provisionFor === item.guardianId && (
                        <form
                          onSubmit={(event) => void provision(event, item)}
                          aria-label={`Provision account for ${item.name}`}
                        >
                          <label className="field">
                            Guardian account email
                            <input
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              required
                              autoComplete="off"
                            />
                          </label>
                          <label className="field">
                            Guardian display name
                            <input
                              value={displayName}
                              onChange={(event) =>
                                setDisplayName(event.target.value)
                              }
                              required
                            />
                          </label>
                          <label className="field">
                            Guardian initial password
                            <input
                              type="password"
                              value={initialPassword}
                              onChange={(event) =>
                                setInitialPassword(event.target.value)
                              }
                              required
                              minLength={12}
                              autoComplete="new-password"
                            />
                          </label>
                          <button type="submit" disabled={busy}>
                            Create guardian account
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
