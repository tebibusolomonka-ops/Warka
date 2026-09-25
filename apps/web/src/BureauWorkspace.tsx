import { useEffect, useState } from 'react'
import {
  changePeriod,
  createPeriod,
  decideSubmission,
  getCoverage,
  listPeriods,
  listSubmissions,
  prepareReport,
  submitReport,
  type BureauAccess,
  type ReportingPeriod,
  type Submission,
} from './bureauApi'

export function BureauWorkspace({
  baseUrl,
  access,
}: {
  baseUrl: string
  access: BureauAccess
}) {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [coverage, setCoverage] = useState<{
    expected: number
    draft: number
    submitted: number
    approved: number
    returned: number
    missing: number
  }>()
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const refresh = async () => {
    const [nextPeriods, nextSubmissions] = await Promise.all([
      listPeriods(baseUrl, access.organizationId),
      listSubmissions(baseUrl, access.organizationId),
    ])
    setPeriods(nextPeriods)
    setSubmissions(nextSubmissions)
    const periodId = selected || nextPeriods[0]?.id
    if (periodId) {
      setSelected(periodId)
      setCoverage(
        (await getCoverage(baseUrl, access.organizationId, periodId)).coverage,
      )
    }
  }
  useEffect(() => {
    void refresh().catch(() => setError('Could not load bureau reporting.'))
  }, [baseUrl, access.organizationId])
  const act = async (operation: () => Promise<unknown>) => {
    setError('')
    try {
      await operation()
      await refresh()
    } catch {
      setError('Reporting action failed.')
    }
  }
  const exportCsv = () => {
    const rows = submissions
      .filter((item) => item.status === 'approved')
      .map((item) => [
        item.reportingPeriod.name,
        item.school.name,
        'snapshot',
        JSON.stringify(item.snapshot),
      ])
    const csv = [['Reporting period', 'School', 'Metric', 'Value'], ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = 'warka-bureau-report.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return (
    <section aria-labelledby="bureau-heading">
      <h2 id="bureau-heading">Bureau reporting</h2>
      <p>{access.organization.name}</p>
      {error && <p role="alert">{error}</p>}
      <nav aria-label="Bureau reporting sections">
        Overview · Reporting periods · School submissions · Enrollment ·
        Academic outcomes · Transfers · Verification activity
      </nav>
      {coverage && (
        <dl>
          <dt>Expected schools</dt>
          <dd>{coverage.expected}</dd>
          <dt>Submitted</dt>
          <dd>{coverage.submitted}</dd>
          <dt>Approved</dt>
          <dd>{coverage.approved}</dd>
          <dt>Returned</dt>
          <dd>{coverage.returned}</dd>
          <dt>Missing</dt>
          <dd>{coverage.missing}</dd>
        </dl>
      )}
      <label>
        Reporting period
        <select
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value)
            void getCoverage(
              baseUrl,
              access.organizationId,
              event.target.value,
            ).then((value) => setCoverage(value.coverage))
          }}
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.name} ({period.status})
            </option>
          ))}
        </select>
      </label>
      {access.role === 'reportManager' && (
        <>
          <button
            type="button"
            onClick={() =>
              void act(() =>
                createPeriod(baseUrl, access.organizationId, {
                  name: `Regional report ${new Date().toISOString().slice(0, 10)}`,
                  startsOn: new Date(Date.now() - 86400000).toISOString(),
                  endsOn: new Date().toISOString(),
                  submissionDueOn: new Date(
                    Date.now() + 86400000,
                  ).toISOString(),
                }),
              )
            }
          >
            Create reporting period
          </button>
          {selected && (
            <button
              type="button"
              onClick={() =>
                void act(() =>
                  changePeriod(
                    baseUrl,
                    access.organizationId,
                    selected,
                    periods.find((item) => item.id === selected)?.status ===
                      'draft'
                      ? 'open'
                      : 'close',
                  ),
                )
              }
            >
              Change period state
            </button>
          )}
        </>
      )}
      <h3>School submissions</h3>
      <ul>
        {submissions.map((item) => (
          <li key={item.id}>
            <strong>{item.school.name}</strong> — {item.status}
            {item.returnReason ? `: ${item.returnReason}` : ''}
            {access.role === 'reportManager' && item.status === 'submitted' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void act(() =>
                      decideSubmission(
                        baseUrl,
                        access.organizationId,
                        item.id,
                        'approve',
                      ),
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void act(() =>
                      decideSubmission(
                        baseUrl,
                        access.organizationId,
                        item.id,
                        'return',
                        'Source records require correction',
                      ),
                    )
                  }
                >
                  Return
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={exportCsv}>
        Export approved CSV
      </button>
    </section>
  )
}

export function SchoolReportingWorkspace({
  baseUrl,
  schoolId,
  periods,
}: {
  baseUrl: string
  schoolId: string
  periods: ReportingPeriod[]
}) {
  const open = periods.find(
    (item) =>
      item.status === 'open' &&
      item.requirements.some(
        (requirement) => requirement.school.id === schoolId,
      ),
  )
  const [message, setMessage] = useState('')
  if (!open)
    return (
      <section>
        <h3>Reporting</h3>
        <p>No open required report.</p>
      </section>
    )
  return (
    <section>
      <h3>Reporting</h3>
      <p>{open.name}</p>
      <button
        type="button"
        onClick={() =>
          void prepareReport(baseUrl, schoolId, open.id).then(() =>
            setMessage('Preview prepared from official records.'),
          )
        }
      >
        Preview report
      </button>
      <button
        type="button"
        onClick={() =>
          void submitReport(baseUrl, schoolId, open.id).then(() =>
            setMessage('Report submitted.'),
          )
        }
      >
        Submit report
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
