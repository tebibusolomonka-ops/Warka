import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  LoginCredentialsSchema,
  selectLocale,
  type SupportedLocale,
} from '@warka/shared'
import { ApiError } from './api'
import { requestRecovery, resetRecovery } from './securityApi'
import {
  AuthShell,
  AuthTextInput,
  FormActions,
  InlineAlert,
  LoadingButton,
  PasswordField,
  authText,
} from './AuthPrimitives'

export type PublicAuthRoute =
  'login' | 'forgot-password' | 'reset-password' | 'not-found'

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/'))
    return pathname.slice(0, -1)
  return pathname
}

export function publicAuthRoute(pathname: string): PublicAuthRoute {
  const path = normalizePath(pathname)
  if (path === '/' || path === '/login') return 'login'
  if (path === '/forgot-password') return 'forgot-password'
  if (path === '/reset-password') return 'reset-password'
  return 'not-found'
}

function currentLocation(): { pathname: string; search: string } {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  }
}

function usePublicLocation() {
  const [location, setLocation] = useState(currentLocation)
  useEffect(() => {
    const update = () => setLocation(currentLocation())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return location
}

export function navigatePublicAuth(path: string, replace = false) {
  if (replace) window.history.replaceState({}, '', path)
  else window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AuthLink({ to, children }: { to: string; children: string }) {
  return (
    <a
      href={to}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return
        event.preventDefault()
        navigatePublicAuth(to)
      }}
    >
      {children}
    </a>
  )
}

function LoginPage({
  baseUrl,
  locale,
  onLocaleChange,
  onAuthenticate,
  serviceMessage,
  serviceAction,
  serviceActionLabel,
}: {
  baseUrl: string | null
  locale: SupportedLocale
  onLocaleChange: (locale: SupportedLocale) => void
  onAuthenticate: (email: string, password: string) => Promise<void>
  serviceMessage?: string | undefined
  serviceAction?: (() => void) | undefined
  serviceActionLabel?: string | undefined
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = (key: Parameters<typeof authText>[1]) => authText(locale, key)

  useEffect(() => {
    document.title = `${t('auth.loginTitle')} | Warka`
  }, [locale])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = LoginCredentialsSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(t('auth.loginValidation'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAuthenticate(parsed.data.email, parsed.data.password)
      setPassword('')
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'INVALID_CREDENTIALS'
          ? t('auth.invalidCredentials')
          : t('auth.loginUnavailable'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      description={t('auth.loginDescription')}
      locale={locale}
      onLocaleChange={onLocaleChange}
      footer={<p>{t('auth.authorizedUse')}</p>}
    >
      {serviceMessage && (
        <InlineAlert tone="error" title={t('auth.serviceNotice')}>
          <p>{serviceMessage}</p>
          {serviceAction && serviceActionLabel && (
            <button
              type="button"
              className="auth-inline-action"
              onClick={serviceAction}
            >
              {serviceActionLabel}
            </button>
          )}
        </InlineAlert>
      )}
      {error && (
        <InlineAlert id="signin-error" tone="error" focusOnMount>
          {error}
        </InlineAlert>
      )}
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <AuthTextInput
          id="login-email"
          name="loginEmail"
          label={t('auth.email')}
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'signin-error' : undefined}
          required
        />
        <PasswordField
          id="login-password"
          name="loginPassword"
          label={t('auth.password')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          invalid={!!error}
          describedById={error ? 'signin-error' : undefined}
        />
        <div className="auth-form-meta">
          <AuthLink to="/forgot-password">{t('auth.forgotPassword')}</AuthLink>
        </div>
        <FormActions>
          <LoadingButton
            type="submit"
            busy={busy}
            busyLabel={t('auth.signingIn')}
            disabled={!baseUrl}
          >
            {t('navigation.signIn')}
          </LoadingButton>
        </FormActions>
      </form>
    </AuthShell>
  )
}

function ForgotPasswordPage({
  baseUrl,
  locale,
  onLocaleChange,
}: {
  baseUrl: string | null
  locale: SupportedLocale
  onLocaleChange: (locale: SupportedLocale) => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const t = (key: Parameters<typeof authText>[1]) => authText(locale, key)

  useEffect(() => {
    document.title = `${t('auth.forgotTitle')} | Warka`
  }, [locale])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!baseUrl) return
    setBusy(true)
    setUnavailable(false)
    try {
      await requestRecovery(baseUrl, email)
      setAccepted(true)
    } catch {
      setUnavailable(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      description={t('auth.forgotDescription')}
      locale={locale}
      onLocaleChange={onLocaleChange}
      footer={<AuthLink to="/login">{t('auth.backToLogin')}</AuthLink>}
    >
      {accepted ? (
        <div className="auth-complete-state">
          <div className="auth-complete-icon" aria-hidden="true">
            ✓
          </div>
          <InlineAlert tone="success" title={t('auth.checkEmailTitle')}>
            <p>{t('auth.recoveryNeutral')}</p>
          </InlineAlert>
          <p>{t('auth.checkEmailDescription')}</p>
          <AuthLink to="/login">{t('auth.backToLogin')}</AuthLink>
        </div>
      ) : (
        <>
          {unavailable && (
            <InlineAlert tone="error">
              {t('auth.recoveryUnavailable')}
            </InlineAlert>
          )}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <AuthTextInput
              id="recovery-email"
              name="recoveryEmail"
              label={t('auth.recoveryEmail')}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <FormActions>
              <LoadingButton
                type="submit"
                busy={busy}
                busyLabel={t('auth.sendingRecovery')}
                disabled={!baseUrl}
              >
                {t('auth.requestRecovery')}
              </LoadingButton>
            </FormActions>
          </form>
        </>
      )}
    </AuthShell>
  )
}

function takeRecoveryToken(search: string): string {
  const parameters = new URLSearchParams(search)
  const token = parameters.get('recoveryToken') ?? ''
  if (token) window.history.replaceState({}, '', '/reset-password')
  return token
}

function ResetPasswordPage({
  baseUrl,
  locale,
  onLocaleChange,
  search,
}: {
  baseUrl: string | null
  locale: SupportedLocale
  onLocaleChange: (locale: SupportedLocale) => void
  search: string
}) {
  const [token] = useState(() => takeRecoveryToken(search))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const t = (key: Parameters<typeof authText>[1]) => authText(locale, key)

  useEffect(() => {
    document.title = `${t('auth.resetTitle')} | Warka`
  }, [locale])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!baseUrl || !token) return
    if (password.length < 12) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (password !== confirmation) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await resetRecovery(baseUrl, token, password)
      setPassword('')
      setConfirmation('')
      setComplete(true)
    } catch {
      setError(t('auth.recoveryTokenInvalid'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.resetTitle')}
      description={t('auth.resetDescription')}
      locale={locale}
      onLocaleChange={onLocaleChange}
      footer={<AuthLink to="/login">{t('auth.backToLogin')}</AuthLink>}
    >
      {!token ? (
        <InlineAlert tone="error" title={t('auth.missingTokenTitle')}>
          <p>{t('auth.missingTokenDescription')}</p>
          <AuthLink to="/forgot-password">{t('auth.requestNewLink')}</AuthLink>
        </InlineAlert>
      ) : complete ? (
        <div className="auth-complete-state">
          <div className="auth-complete-icon" aria-hidden="true">
            ✓
          </div>
          <InlineAlert tone="success" title={t('auth.resetCompleteTitle')}>
            {t('auth.recoveryReset')}
          </InlineAlert>
          <AuthLink to="/login">{t('auth.signInWithNewPassword')}</AuthLink>
        </div>
      ) : (
        <>
          {error && (
            <InlineAlert id="reset-error" tone="error">
              {error}
            </InlineAlert>
          )}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <PasswordField
              id="new-password"
              name="newPassword"
              label={t('auth.newPassword')}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint={t('auth.passwordRequirements')}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              minLength={12}
            />
            <PasswordField
              id="confirm-password"
              name="confirmPassword"
              label={t('auth.confirmPassword')}
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              minLength={12}
            />
            <FormActions>
              <LoadingButton
                type="submit"
                busy={busy}
                busyLabel={t('auth.resettingPassword')}
                disabled={!baseUrl}
              >
                {t('auth.resetPassword')}
              </LoadingButton>
            </FormActions>
          </form>
        </>
      )}
    </AuthShell>
  )
}

function NotFoundPage({
  locale,
  onLocaleChange,
}: {
  locale: SupportedLocale
  onLocaleChange: (locale: SupportedLocale) => void
}) {
  const t = (key: Parameters<typeof authText>[1]) => authText(locale, key)
  useEffect(() => {
    document.title = `${t('auth.notFoundTitle')} | Warka`
  }, [locale])
  return (
    <AuthShell
      title={t('auth.notFoundTitle')}
      description={t('auth.notFoundDescription')}
      locale={locale}
      onLocaleChange={onLocaleChange}
    >
      <InlineAlert tone="info">{t('auth.notFoundHelp')}</InlineAlert>
      <FormActions>
        <AuthLink to="/login">{t('auth.backToLogin')}</AuthLink>
      </FormActions>
    </AuthShell>
  )
}

export function PublicAuthentication({
  baseUrl,
  onAuthenticate,
  serviceMessage,
  serviceAction,
  serviceActionLabel,
}: {
  baseUrl: string | null
  onAuthenticate: (email: string, password: string) => Promise<void>
  serviceMessage?: string | undefined
  serviceAction?: (() => void) | undefined
  serviceActionLabel?: string | undefined
}) {
  const location = usePublicLocation()
  const route = new URLSearchParams(location.search).has('recoveryToken')
    ? 'reset-password'
    : publicAuthRoute(location.pathname)
  const initialLocale = useMemo(
    () =>
      selectLocale(
        typeof navigator === 'undefined' ? undefined : navigator.language,
      ),
    [],
  )
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale)
  if (route === 'forgot-password')
    return (
      <ForgotPasswordPage
        baseUrl={baseUrl}
        locale={locale}
        onLocaleChange={setLocale}
      />
    )
  if (route === 'reset-password')
    return (
      <ResetPasswordPage
        key={location.search}
        baseUrl={baseUrl}
        locale={locale}
        onLocaleChange={setLocale}
        search={location.search}
      />
    )
  if (route === 'not-found')
    return <NotFoundPage locale={locale} onLocaleChange={setLocale} />
  return (
    <LoginPage
      baseUrl={baseUrl}
      locale={locale}
      onLocaleChange={setLocale}
      onAuthenticate={onAuthenticate}
      serviceMessage={serviceMessage}
      serviceAction={serviceAction}
      serviceActionLabel={serviceActionLabel}
    />
  )
}
