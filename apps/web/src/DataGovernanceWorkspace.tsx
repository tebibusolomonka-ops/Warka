import { useEffect, useState, type FormEvent } from 'react'
import {
  createRetentionHold,
  getDataGovernanceSummary,
  getRetentionHolds,
  releaseRetentionHold,
  type GovernanceSummary,
  type RetentionHold,
} from './dataGovernanceApi'

export function DataGovernanceWorkspace({
  baseUrl,
  organizationId,
  schoolId,
}: {
  baseUrl: string
  organizationId: string
  schoolId: string
}) {
  const [summary, setSummary] = useState<GovernanceSummary | null>(null)
  const [holds, setHolds] = useState<RetentionHold[]>([])
  const [scope, setScope] = useState<RetentionHold['scope']>('student')
  const [recordId, setRecordId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([
      getDataGovernanceSummary(baseUrl, schoolId),
      getRetentionHolds(baseUrl, organizationId),
    ])
      .then(([nextSummary, page]) => {
        if (active) {
          setSummary(nextSummary)
          setHolds(page.items)
        }
      })
      .catch(() => {
        if (active) setError('Could not load data governance summary.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, organizationId, schoolId, refresh])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createRetentionHold(baseUrl, organizationId, {
        scope,
        recordId,
        reason,
      })
      setRecordId('')
      setReason('')
      setRefresh((value) => value + 1)
    } catch {
      setError('Could not create retention hold.')
    } finally {
      setBusy(false)
    }
  }
  async function release(id: string) {
    setBusy(true)
    setError('')
    try {
      await releaseRetentionHold(baseUrl, organizationId, id)
      setRefresh((value) => value + 1)
    } catch {
      setError('Could not release retention hold.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Data governance" id="data-governance">
      <h3>Data governance</h3>
      <nav aria-label="Data governance navigation">
        <a href="#privacy-review">Privacy requests</a>{' '}
        <a href="#students-heading">Record corrections</a>{' '}
        <a href="#staff-lifecycle">Access reviews</a>{' '}
        <a href="#governance-heading">Retention policies</a>{' '}
        <a href="#retention-holds">Retention holds</a>
      </nav>
      {summary && (
        <>
          <p>
            Open privacy requests: {summary.openRequests} · Active processing
            restrictions: {summary.activeRestrictions}
          </p>
          <h4>Request status</h4>
          <ul>
            {summary.statuses.map((item) => (
              <li key={item.status}>
                {item.status}: {item.count}
              </li>
            ))}
          </ul>
          <h4>Recent record corrections</h4>
          <ul>
            {summary.recentCorrections.map((item) => (
              <li key={item.id}>
                {item.field} · {item.status} ·{' '}
                {new Date(item.requestedAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
          <h4>Staff access changes</h4>
          <ul>
            {summary.recentStaffChanges.map((item) => (
              <li key={item.id}>
                {item.action} · {new Date(item.occurredAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      )}
      <div id="retention-holds">
        <h4>Retention holds</h4>
        <p>
          Holds affect retention eligibility calculations. Releasing a hold does
          not delete records.
        </p>
        <form
          aria-label="Create retention hold"
          onSubmit={(event) => void create(event)}
        >
          <label>
            Scope{' '}
            <select
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as RetentionHold['scope'])
              }
            >
              <option value="student">Student</option>
              <option value="privacyRequest">Privacy request</option>
              <option value="issuedDocument">Issued document</option>
            </select>
          </label>
          <label>
            Record ID{' '}
            <input
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              required
            />
          </label>
          <label>
            Reason{' '}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={500}
              required
            />
          </label>
          <button disabled={busy}>Create hold</button>
        </form>
        <ul>
          {holds.map((item) => (
            <li key={item.id}>
              {item.scope} · {item.releasedAt ? 'Released' : 'Active'} ·{' '}
              {item.reason}
              {!item.releasedAt && (
                <button disabled={busy} onClick={() => void release(item.id)}>
                  Release hold
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
