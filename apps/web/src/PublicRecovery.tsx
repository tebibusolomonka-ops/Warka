import { useState, type FormEvent } from 'react'
import { requestRecovery, resetRecovery } from './securityApi'
import { createTranslator } from '@warka/shared'
import { browserLocale } from './LocalizedNavigation'

export function PublicRecovery({
  baseUrl,
  locale,
}: {
  baseUrl: string
  locale?: string | undefined
}) {
  const t = createTranslator({ locale: locale ?? browserLocale() })
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
      setMessage(t('auth.recoveryRequestFailed'))
      return
    }
    setMessage(t('auth.recoveryNeutral'))
  }
  async function reset(event: FormEvent) {
    event.preventDefault()
    try {
      await resetRecovery(baseUrl, token, password)
      setMessage(t('auth.recoveryReset'))
      setToken('')
      setPassword('')
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      setMessage(t('auth.recoveryTokenInvalid'))
    }
  }
  return (
    <section aria-label={t('auth.accountRecovery')}>
      <h3>{t('auth.accountRecovery')}</h3>
      <form onSubmit={(event) => void request(event)}>
        <label>
          {t('auth.recoveryEmail')}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button type="submit">{t('auth.requestRecovery')}</button>
      </form>
      <form onSubmit={(event) => void reset(event)}>
        <label>
          {t('auth.recoveryToken')}
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </label>
        <label>
          {t('auth.recoveryPassword')}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            required
          />
        </label>
        <button type="submit">{t('auth.resetPassword')}</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
