import { useState, type FormEvent } from 'react'
import { requestRecovery, resetRecovery } from './securityApi'

export function PublicRecovery({ baseUrl }: { baseUrl: string }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(() => {
    const url = new URL(window.location.href)
    const supplied = url.searchParams.get('recoveryToken') ?? ''
    if (supplied) {
      url.searchParams.delete('recoveryToken')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
    return supplied
  })
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  async function request(event: FormEvent) {
    event.preventDefault()
    try {
      await requestRecovery(baseUrl, email)
    } catch {
      setMessage('Could not submit recovery request')
      return
    }
    setMessage('If the account exists, recovery instructions will be sent.')
  }
  async function reset(event: FormEvent) {
    event.preventDefault()
    try {
      await resetRecovery(baseUrl, token, password)
      setMessage('Password reset. Sign in with your new password.')
      setToken('')
      setPassword('')
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      setMessage('Invalid or expired recovery token')
    }
  }
  return (
    <section aria-label="Account recovery">
      <h3>Account recovery</h3>
      <form onSubmit={(event) => void request(event)}>
        <label>
          Recovery email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button type="submit">Request recovery</button>
      </form>
      <form onSubmit={(event) => void reset(event)}>
        <label>
          Recovery token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </label>
        <label>
          New recovery password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            required
          />
        </label>
        <button type="submit">Reset password</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
