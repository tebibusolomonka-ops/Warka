import { useEffect, useState } from 'react'
import {
  getRecoverySummary,
  listRecoveryExecutions,
  listRecoveryReviews,
  resolveRecoveryReview,
  retryRecoveryExecution,
  type RecoveryExecution,
  type RecoveryReview,
  type RecoverySummary,
} from './operationsApi'

export function RecoveryWorkspace({ baseUrl }: { baseUrl: string }) {
  const [summary, setSummary] = useState<RecoverySummary>()
  const [executions, setExecutions] = useState<RecoveryExecution[]>([])
  const [reviews, setReviews] = useState<RecoveryReview[]>([])
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([
      getRecoverySummary(baseUrl),
      listRecoveryExecutions(baseUrl),
      listRecoveryReviews(baseUrl),
    ]).then(
      ([nextSummary, nextExecutions, nextReviews]) => {
        if (!active) return
        setSummary(nextSummary)
        setExecutions(nextExecutions)
        setReviews(nextReviews)
      },
      () => active && setError('Could not load recovery status.'),
    )
    return () => {
      active = false
    }
  }, [baseUrl, refresh])
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setRefresh((value) => value + 1)
    } catch {
      setError('The recovery action could not be completed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section id="operations-recovery" aria-labelledby="recovery-heading">
      <h3 id="recovery-heading">Recovery</h3>
      {error && <p role="alert">{error}</p>}
      <p>Startup reconciliation: {summary?.startup.status ?? 'Unknown'}</p>
      <p>
        Disaster recovery readiness:{' '}
        {summary?.disasterRecovery.status ?? 'Unknown'}
      </p>
      <p>
        Latest verified backup:{' '}
        {summary?.disasterRecovery.lastVerification ?? 'None'}
      </p>
      <p>
        Latest restore rehearsal:{' '}
        {summary?.disasterRecovery.lastRestoreRehearsal ?? 'None'}
      </p>
      <ul aria-label="Interrupted executions">
        {executions.map((execution) => (
          <li key={execution.id}>
            {execution.taskType} ·{' '}
            {execution.recoveryDisposition ?? 'unclassified'}
            {' · '}lease {execution.leaseExpiresAt ?? 'unavailable'}
            {execution.recoveryDisposition === 'safeToRetry' && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => retryRecoveryExecution(baseUrl, execution.id))
                }
              >
                Retry safe task
              </button>
            )}
          </li>
        ))}
      </ul>
      <ul aria-label="Recovery reviews">
        {reviews.map((review) => (
          <li key={review.id}>
            {review.domain} · {review.reasonCode} · {review.status}
            {review.status === 'open' && review.domain === 'emailDelivery' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      resolveRecoveryReview(
                        baseUrl,
                        review.id,
                        'confirmedDelivered',
                      ),
                    )
                  }
                >
                  Confirm delivered
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      resolveRecoveryReview(
                        baseUrl,
                        review.id,
                        'confirmedNotDelivered',
                      ),
                    )
                  }
                >
                  Confirm not delivered
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
