import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import {
  createTranslator,
  supportedLocales,
  type SupportedLocale,
  type TranslationKey,
} from '@warka/shared'

export type AlertTone = 'error' | 'success' | 'info'

export function AuthShell({
  title,
  description,
  locale,
  onLocaleChange,
  children,
  footer,
}: {
  title: string
  description: string
  locale: SupportedLocale
  onLocaleChange: (locale: SupportedLocale) => void
  children: ReactNode
  footer?: ReactNode
}) {
  const t = createTranslator({ locale })
  return (
    <div className="auth-shell">
      <section className="auth-brand" aria-labelledby="auth-brand-title">
        <div className="auth-brand-mark" aria-hidden="true">
          W
        </div>
        <div>
          <p className="auth-eyebrow">{t('auth.productEyebrow')}</p>
          <h1 id="auth-brand-title">Warka</h1>
          <p className="auth-brand-copy">{t('auth.productDescription')}</p>
        </div>
        <ul
          className="auth-brand-points"
          aria-label={t('auth.productHighlights')}
        >
          <li>{t('auth.highlightRecords')}</li>
          <li>{t('auth.highlightFamilies')}</li>
          <li>{t('auth.highlightReporting')}</li>
        </ul>
      </section>
      <section className="auth-card" aria-labelledby="auth-page-title">
        <div className="auth-locale">
          <label htmlFor="auth-language">{t('settings.language')}</label>
          <select
            id="auth-language"
            value={locale}
            onChange={(event) =>
              onLocaleChange(event.target.value as SupportedLocale)
            }
          >
            {supportedLocales.map((value) => (
              <option key={value} value={value}>
                {t(
                  value === 'en'
                    ? 'locale.english'
                    : value === 'am'
                      ? 'locale.amharic'
                      : 'locale.oromo',
                )}
              </option>
            ))}
          </select>
        </div>
        <div className="auth-heading">
          <h2 id="auth-page-title">{title}</h2>
          <p>{description}</p>
        </div>
        {children}
        {footer && <footer className="auth-card-footer">{footer}</footer>}
      </section>
    </div>
  )
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string | undefined
  error?: string | undefined
  children: ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="auth-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="auth-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function describedBy(
  id: string,
  options: {
    hint?: boolean
    error?: boolean
    additional?: string | undefined
  },
) {
  const ids = [
    options.additional ?? '',
    options.hint ? `${id}-hint` : '',
    options.error ? `${id}-error` : '',
  ].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  showLabel,
  hideLabel,
  required = true,
  minLength,
  invalid = false,
  describedById,
}: {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  hint?: string | undefined
  error?: string | undefined
  showLabel: string
  hideLabel: string
  required?: boolean
  minLength?: number
  invalid?: boolean
  describedById?: string | undefined
}) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <div className="auth-password-control">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || !!error}
          aria-describedby={describedBy(id, {
            additional: describedById,
            hint: !!hint,
            error: !!error,
          })}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
    </FormField>
  )
}

export function InlineAlert({
  tone,
  title,
  children,
  id,
  focusOnMount = false,
}: {
  tone: AlertTone
  title?: string
  children: ReactNode
  id?: string
  focusOnMount?: boolean
}) {
  const generatedId = useId()
  const titleId = `${id ?? generatedId}-title`
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusOnMount) alertRef.current?.focus()
  }, [focusOnMount])
  return (
    <div
      ref={alertRef}
      id={id}
      className={`auth-alert auth-alert-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      tabIndex={focusOnMount ? -1 : undefined}
      aria-labelledby={title ? titleId : undefined}
    >
      {title && (
        <strong id={titleId} className="auth-alert-title">
          {title}
        </strong>
      )}
      <div className="auth-alert-body">{children}</div>
    </div>
  )
}

export function LoadingButton({
  busy,
  busyLabel,
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy: boolean
  busyLabel: string
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      {...props}
      className={`auth-button auth-button-${variant}`}
      disabled={busy || props.disabled}
      aria-busy={busy}
    >
      {busy && <span className="auth-spinner" aria-hidden="true" />}
      <span>{busy ? busyLabel : children}</span>
    </button>
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="auth-actions">{children}</div>
}

export function AuthTextInput({
  id,
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string | undefined
  error?: string | undefined
}) {
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <input
        {...props}
        id={id}
        aria-invalid={!!error || props['aria-invalid'] === true}
        aria-describedby={describedBy(id, {
          additional: props['aria-describedby'],
          hint: !!hint,
          error: !!error,
        })}
      />
    </FormField>
  )
}

export function authText(locale: SupportedLocale, key: TranslationKey): string {
  return createTranslator({ locale })(key)
}
