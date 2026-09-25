import { useEffect, useState, type FormEvent } from 'react'
import type { StudentAccountStatus } from '@warka/shared'
import {
  ApiError,
  getStudentAccountStatus,
  provisionStudentAccount,
} from './api'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentAccountStatus }

export function StudentAccountPanel({
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
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [initialPassword, setInitialPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    getStudentAccountStatus(baseUrl, schoolId, studentId)
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await provisionStudentAccount(baseUrl, schoolId, studentId, {
        email,
        displayName,
        initialPassword,
      })
      setInitialPassword('')
      setEmail('')
      setDisplayName('')
      setMessage('Student account created.')
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else
        setError(
          cause instanceof ApiError && cause.code === 'STUDENT_ACCOUNT_CONFLICT'
            ? cause.message
            : 'Could not create student account.',
        )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="academic-panel"
      aria-labelledby="student-account-heading"
    >
      <h4 id="student-account-heading">Portal access</h4>
      {load.status === 'loading' && <p role="status">Loading portal access</p>}
      {load.status === 'error' && (
        <div role="alert">
          <p>Could not load portal access.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {load.status === 'loaded' && load.data.status === 'active' && (
        <>
          <p>
            {load.data.mustChangePassword
              ? 'Password change required'
              : 'Account active'}
          </p>
          <p>
            {load.data.displayName} � {load.data.email}
          </p>
        </>
      )}
      {load.status === 'loaded' && load.data.status === 'none' && (
        <>
          <p>No account</p>
          <form onSubmit={submit} aria-label="Create student account">
            <label className="field">
              Account email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="off"
              />
            </label>
            <label className="field">
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
            <label className="field">
              Initial password
              <input
                type="password"
                value={initialPassword}
                onChange={(event) => setInitialPassword(event.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Creating account' : 'Create account'}
            </button>
          </form>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
