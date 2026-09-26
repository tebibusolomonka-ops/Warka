import { useEffect, useState } from 'react'
import {
  assignRequiredSchools,
  changePeriod,
  createPeriod,
  decideSubmission,
  getCoverage,
  listBureauSchools,
  listPeriods,
  listSchoolReports,
  listSubmissions,
  prepareReport,
  removeRequiredSchool,
  submitReport,
  type BureauAccess,
  type BureauSchool,
  type ReportingPeriod,
  type SchoolReport,
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
  const [schools, setSchools] = useState<BureauSchool[]>([])
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
    const [nextPeriods, nextSchools, nextSubmissions] = await Promise.all([
      listPeriods(baseUrl, access.organizationId),
      listBureauSchools(baseUrl, access.organizationId),
      listSubmissions(baseUrl, access.organizationId),
    ])
    setPeriods(nextPeriods)
    setSchools(nextSchools)
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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Reporting action failed.',
      )
    }
  }
  const period = periods.find((item) => item.id === selected)
  const required = new Set(
    period?.requirements.map((item) => item.school.id) ?? [],
  )
  const submissionBySchool = new Map(
    submissions
      .filter((item) => item.reportingPeriod.id === selected)
      .map((item) => [item.school.id, item]),
  )
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
          {periods.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.status})
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
          {period && (
            <button
              type="button"
              onClick={() =>
                void act(() =>
                  changePeriod(
                    baseUrl,
                    access.organizationId,
                    period.id,
                    period.status === 'draft' ? 'open' : 'close',
                  ),
                )
              }
            >
              Change period state
            </button>
          )}
        </>
      )}
      {period && (
        <section aria-labelledby="required-schools-heading">
          <h3 id="required-schools-heading">Required schools</h3>
          <ul>
            {schools.map((school) => {
              const submission = submissionBySchool.get(school.id)
              const isRequired = required.has(school.id)
              return (
                <li key={school.id}>
                  <strong>{school.name}</strong> —{' '}
                  {isRequired
                    ? (submission?.status ?? 'missing')
                    : 'not required'}
                  {access.role === 'reportManager' &&
                    (!isRequired ? (
                      <button
                        type="button"
                        onClick={() =>
                          void act(() =>
                            assignRequiredSchools(
                              baseUrl,
                              access.organizationId,
                              period.id,
                              [school.id],
                            ),
                          )
                        }
                      >
                        Require report
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(submission)}
                        onClick={() =>
                          void act(() =>
                            removeRequiredSchool(
                              baseUrl,
                              access.organizationId,
                              period.id,
                              school.id,
                            ),
                          )
                        }
                      >
                        Remove requirement
                      </button>
                    ))}
                </li>
              )
            })}
          </ul>
        </section>
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
}: {
  baseUrl: string
  schoolId: string
}) {
  const [reports, setReports] = useState<SchoolReport[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const refresh = async () => {
    const next = await listSchoolReports(baseUrl, schoolId)
    setReports(next)
    setSelectedId((current) =>
      next.some((item) => item.reportingPeriodId === current)
        ? current
        : (next[0]?.reportingPeriodId ?? ''),
    )
  }
  useEffect(() => {
    void refresh().catch(() => setError('Could not load school reporting.'))
  }, [baseUrl, schoolId])
  const report = reports.find((item) => item.reportingPeriodId === selectedId)
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setError('')
    setMessage('')
    try {
      await operation()
      setMessage(success)
      await refresh()
    } catch {
      setError('Reporting action failed.')
    }
  }
  return (
    <section aria-labelledby="school-reporting-heading">
      <h3 id="school-reporting-heading">Reporting</h3>
      {error && <p role="alert">{error}</p>}
      {reports.length === 0 && !error && (
        <p>This school is not currently required to report.</p>
      )}
      {reports.length > 0 && (
        <>
          <label>
            Reporting period
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {reports.map((item) => (
                <option
                  key={item.reportingPeriodId}
                  value={item.reportingPeriodId}
                >
                  {item.reportingPeriod.name}
                </option>
              ))}
            </select>
          </label>
          {report && (
            <>
              <p>Period status: {report.reportingPeriod.status}</p>
              <p>Submission status: {report.submission?.status ?? 'missing'}</p>
              {report.submission?.returnReason && (
                <p>Return reason: {report.submission.returnReason}</p>
              )}
              {report.submission?.snapshot && (
                <section aria-label="Report aggregates">
                  <h4>Aggregate preview</h4>
                  <pre>
                    {JSON.stringify(report.submission.snapshot, null, 2)}
                  </pre>
                </section>
              )}
              <button
                type="button"
                disabled={
                  report.reportingPeriod.status !== 'open' ||
                  ['submitted', 'approved'].includes(
                    report.submission?.status ?? '',
                  )
                }
                onClick={() =>
                  void run(
                    () =>
                      prepareReport(
                        baseUrl,
                        schoolId,
                        report.reportingPeriodId,
                      ),
                    'Preview prepared from official records.',
                  )
                }
              >
                Preview report
              </button>
              <button
                type="button"
                disabled={
                  report.reportingPeriod.status !== 'open' ||
                  !report.submission ||
                  ['submitted', 'approved'].includes(report.submission.status)
                }
                onClick={() =>
                  void run(
                    () =>
                      submitReport(baseUrl, schoolId, report.reportingPeriodId),
                    'Report submitted.',
                  )
                }
              >
                {report.submission?.status === 'returned'
                  ? 'Resubmit report'
                  : 'Submit report'}
              </button>
            </>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
