import { useEffect, useState } from 'react'
import {
  dismissQualityIssue,
  getLatestQualityRun,
  listQualityIssues,
  runQualityChecks,
  type QualityIssue,
  type QualityRun,
} from './dataQualityApi'

const destination: Record<string, string> = {
  student: '#students-heading',
  enrollment: '#students-heading',
  academic: '#academic-workspace-heading',
  document: '#school-documents-heading',
}
export function DataQualityWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [run, setRun] = useState<QualityRun | null>(null)
  const [issues, setIssues] = useState<QualityIssue[]>([])
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('open')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [reason, setReason] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    getLatestQualityRun(baseUrl, schoolId)
      .then(({ run }) => {
        if (active) setRun(run)
      })
      .catch(() => {
        if (active) setError('Could not load quality evaluation.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, revision])
  useEffect(() => {
    let active = true
    listQualityIssues(baseUrl, schoolId, {
      ...(category ? { category } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    })
      .then((value) => {
        if (active) {
          setIssues(value.issues)
          setNextCursor(value.nextCursor)
        }
      })
      .catch(() => {
        if (active) setError('Could not load quality issues.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, category, severity, status, revision])
  async function action(task: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await task()
      setMessage(success)
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Quality action failed.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function more() {
    if (!nextCursor) return
    try {
      const value = await listQualityIssues(baseUrl, schoolId, {
        ...(category ? { category } : {}),
        ...(severity ? { severity } : {}),
        ...(status ? { status } : {}),
        cursor: nextCursor,
      })
      setIssues((current) => [...current, ...value.issues])
      setNextCursor(value.nextCursor)
    } catch {
      setError('Could not load more issues.')
    }
  }
  return (
    <section className="academic-panel" aria-labelledby="data-quality-heading">
      <h2 id="data-quality-heading">Data quality</h2>
      <p>
        Checks are factual and do not change school records or score the school.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <p>
        Last evaluation:{' '}
        {run
          ? `${run.status} · ${new Date(run.startedAt).toLocaleString()}`
          : 'None'}
      </p>
      {run && (
        <p>
          {run.blockingCount} blocking, {run.warningCount} warnings,{' '}
          {run.infoCount} informational findings.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void action(
            () => runQualityChecks(baseUrl, schoolId),
            'Evaluation completed.',
          )
        }
      >
        Run evaluation
      </button>
      <label>
        Category{' '}
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All</option>
          {['student', 'enrollment', 'academic', 'document'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Severity{' '}
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="">All</option>
          {['info', 'warning', 'blocking'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status{' '}
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All</option>
          {['open', 'resolved', 'dismissed'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {issues.length === 0 && <p>No matching issues.</p>}
      <ul>
        {issues.map((issue) => (
          <li key={issue.id}>
            <strong>{issue.code}</strong> — {issue.summary} ({issue.category},{' '}
            {issue.severity}, {issue.status}){' '}
            <a href={destination[issue.category] ?? '#data-quality-heading'}>
              Open related workflow
            </a>
            {issue.status === 'open' && issue.severity !== 'blocking' && (
              <span>
                <label>
                  Dismissal reason{' '}
                  <input
                    value={reason[issue.id] ?? ''}
                    onChange={(event) =>
                      setReason({ ...reason, [issue.id]: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || (reason[issue.id]?.trim().length ?? 0) < 3}
                  onClick={() =>
                    void action(
                      () =>
                        dismissQualityIssue(
                          baseUrl,
                          schoolId,
                          issue.id,
                          reason[issue.id] ?? '',
                        ),
                      'Issue dismissed.',
                    )
                  }
                >
                  Dismiss
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {nextCursor && (
        <button type="button" onClick={() => void more()}>
          Load more issues
        </button>
      )}
    </section>
  )
}
