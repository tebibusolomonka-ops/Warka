import { useEffect, useState } from 'react'
import {
  listEmailDeliveries,
  retryEmailDelivery,
  type EmailDeliverySummary,
} from './operationsApi'

export function EmailDeliveryWorkspace({
  baseUrl,
  provider,
  counts,
  retryCount,
}: {
  baseUrl: string
  provider: 'available' | 'unavailable' | 'degraded' | 'disabled'
  counts: Record<string, number>
  retryCount: number
}) {
  const [deliveries, setDeliveries] = useState<EmailDeliverySummary[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    listEmailDeliveries(baseUrl)
      .then((items) => {
        if (active) setDeliveries(items)
      })
      .catch(() => {
        if (active) setError('Could not load email delivery status.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh])

  async function retry(id: string) {
    setBusy(true)
    setError('')
    try {
      await retryEmailDelivery(baseUrl, id)
      setRefresh((value) => value + 1)
    } catch {
      setError('Email delivery could not be retried.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="operations-email" aria-label="Email delivery">
      <h3>Email delivery</h3>
      <p>Provider: {provider}</p>
      <p>Queued: {counts.queued ?? 0}</p>
      <p>Sending: {counts.sending ?? 0}</p>
      <p>Sent: {counts.sent ?? 0}</p>
      <p>Failed: {counts.failed ?? 0}</p>
      <p>Retries: {retryCount}</p>
      {error && <p role="alert">{error}</p>}
      <ul>
        {deliveries.map((delivery) => (
          <li key={delivery.id}>
            {delivery.recipient} · {delivery.templateKey} · {delivery.status} ·{' '}
            attempt {delivery.attemptCount}
            {delivery.failureCode && ` · ${delivery.failureCode}`}
            {delivery.retryEligible && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void retry(delivery.id)}
              >
                Retry delivery
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
