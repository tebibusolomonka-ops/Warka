import { useEffect, useState } from 'react'
import {
  assignRequiredSchools,
  changePeriod,
  createPeriod,
  decideSubmission,
  downloadReportingExport,
  getRegionalValidation,
  getReportingReadiness,
  listBureauReportingNotes,
  listSchoolReportingNotes,
  addBureauReportingNote,
  addSchoolReportingNote,
  resubmitReport,
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
  type ReportingNote,
  type ReportingReadiness,
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
  const [notes, setNotes] = useState<ReportingNote[]>([])
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteVisibility, setNoteVisibility] = useState<
    'schoolAndBureau' | 'bureauInternal'
  >('schoolAndBureau')
  const [validationIssues, setValidationIssues] = useState<
    { schoolId: string | null; code: string; severity: string }[]
  >([])
  const [coverage, setCoverage] = useState<{
    expected: number
    draft: number
    submitted: number
    underReview: number
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
      setValidationIssues(
        (await getRegionalValidation(baseUrl, access.organizationId, periodId))
          .issues,
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
  const selectedSubmission = submissions.find(
    (item) => item.id === selectedSubmissionId,
  )
  useEffect(() => {
    if (!selectedSubmissionId) {
      setNotes([])
      return
    }
    void listBureauReportingNotes(
      baseUrl,
      access.organizationId,
      selectedSubmissionId,
    )
      .then(setNotes)
      .catch(() => setError('Could not load review notes.'))
  }, [baseUrl, access.organizationId, selectedSubmissionId, submissions])
  const exportCsv = async (
    type: 'coverage' | 'enrollment' | 'academic' | 'transfers',
  ) => {
    if (!selected) return
    const csv = await downloadReportingExport(
      baseUrl,
      access.organizationId,
      selected,
      type,
    )
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `warka-reporting-${type}.csv`
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
          <dt>Under review</dt>
          <dd>{coverage.underReview ?? 0}</dd>
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
            void getRegionalValidation(
              baseUrl,
              access.organizationId,
              event.target.value,
            ).then((value) => setValidationIssues(value.issues))
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
      {period && validationIssues.length > 0 && (
        <section aria-label="Regional validation">
          <h3>Regional validation</h3>
          <ul>
            {validationIssues.map((issue, index) => (
              <li key={`${issue.code}-${issue.schoolId}-${index}`}>
                {issue.severity}: {issue.code}
                {issue.schoolId ? ` (${issue.schoolId})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
      <h3>School submissions</h3>
      <ul>
        {submissions.map((item) => (
          <li key={item.id}>
            <strong>{item.school.name}</strong> — {item.status} · version{' '}
            {item.currentVersion ?? 0}
            {item.returnReason ? `: ${item.returnReason}` : ''}
            <button
              type="button"
              onClick={() => setSelectedSubmissionId(item.id)}
            >
              Review details
            </button>
            {access.role === 'reportManager' && item.status === 'submitted' && (
              <button
                type="button"
                onClick={() =>
                  void act(() =>
                    decideSubmission(
                      baseUrl,
                      access.organizationId,
                      item.id,
                      'start-review',
                    ),
                  )
                }
              >
                Start review
              </button>
            )}
            {access.role === 'reportManager' &&
              ['submitted', 'underReview'].includes(item.status) && (
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
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={returnReason.trim().length < 3}
                    onClick={() =>
                      void act(() =>
                        decideSubmission(
                          baseUrl,
                          access.organizationId,
                          item.id,
                          'return',
                          returnReason,
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
      {selectedSubmission && (
        <section aria-label="Reporting review details">
          <h3>{selectedSubmission.school.name} report</h3>
          <p>
            Accepted version: {selectedSubmission.acceptedVersion ?? 'none'}
          </p>
          <h4>Version history</h4>
          <ul>
            {(selectedSubmission.versions ?? []).map((version) => (
              <li key={version.id}>
                Version {version.version}, submitted{' '}
                {new Date(version.submittedAt).toLocaleString()}
                {version.version === selectedSubmission.acceptedVersion
                  ? ' (accepted)'
                  : ''}
                {version.resubmissionReason
                  ? ` — ${version.resubmissionReason}`
                  : ''}
                {version.provenance === 'legacyBackfill'
                  ? ' — last recoverable legacy state; earlier attempts and original checksum unavailable'
                  : ' — native version; checksum recorded'}
                <pre>{JSON.stringify(version.snapshot, null, 2)}</pre>
              </li>
            ))}
          </ul>
          <h4>Review notes</h4>
          <ul>
            {notes.map((note) => (
              <li key={note.id}>
                {note.visibility}: {note.body} — {note.authorUser.displayName}
              </li>
            ))}
          </ul>
          {access.role === 'reportManager' && (
            <>
              <label>
                Return reason
                <input
                  value={returnReason}
                  onChange={(event) => setReturnReason(event.target.value)}
                />
              </label>
              <label>
                Review note
                <textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                />
              </label>
              <label>
                Note visibility
                <select
                  value={noteVisibility}
                  onChange={(event) =>
                    setNoteVisibility(
                      event.target.value as
                        'schoolAndBureau' | 'bureauInternal',
                    )
                  }
                >
                  <option value="schoolAndBureau">School and bureau</option>
                  <option value="bureauInternal">Bureau internal</option>
                </select>
              </label>
              <button
                type="button"
                disabled={!noteBody.trim()}
                onClick={() =>
                  void act(async () => {
                    await addBureauReportingNote(
                      baseUrl,
                      access.organizationId,
                      selectedSubmission.id,
                      noteBody,
                      noteVisibility,
                    )
                    setNoteBody('')
                    setNotes(
                      await listBureauReportingNotes(
                        baseUrl,
                        access.organizationId,
                        selectedSubmission.id,
                      ),
                    )
                  })
                }
              >
                Add review note
              </button>
            </>
          )}
        </section>
      )}
      {period && (
        <div aria-label="Reporting exports">
          {(['coverage', 'enrollment', 'academic', 'transfers'] as const).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => void act(() => exportCsv(type))}
              >
                Export {type} CSV
              </button>
            ),
          )}
        </div>
      )}
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
  const [readiness, setReadiness] = useState<ReportingReadiness>()
  const [notes, setNotes] = useState<ReportingNote[]>([])
  const [resubmissionReason, setResubmissionReason] = useState('')
  const [noteBody, setNoteBody] = useState('')
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
  useEffect(() => {
    if (!selectedId) return
    void getReportingReadiness(baseUrl, schoolId, selectedId)
      .then(setReadiness)
      .catch(() => setReadiness(undefined))
    void listSchoolReportingNotes(baseUrl, schoolId, selectedId)
      .then(setNotes)
      .catch(() => setNotes([]))
  }, [baseUrl, schoolId, selectedId, reports])
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
              <p>
                Submission window:{' '}
                {report.reportingPeriod.opensAt ?? 'when period opens'} to{' '}
                {report.reportingPeriod.closesAt ?? 'period close'}; due{' '}
                {report.reportingPeriod.dueAt ??
                  report.reportingPeriod.submissionDueOn}
              </p>
              <p>Submission status: {report.submission?.status ?? 'missing'}</p>
              <p>
                Accepted version: {report.submission?.acceptedVersion ?? 'none'}
              </p>
              {readiness && (
                <section aria-label="Reporting readiness">
                  <h4>Readiness</h4>
                  <p>
                    {readiness.ready ? 'Ready to submit' : 'Submission blocked'}
                  </p>
                  {report.reportingPeriod.status === 'open' &&
                    readiness.communicationScheduling?.status !== 'ready' &&
                    readiness.communicationScheduling && (
                      <p role="status">
                        Scheduled reporting reminders are not ready for
                        delivery.
                      </p>
                    )}
                  <ul>
                    {(readiness.blocking ?? []).map((code) => (
                      <li key={code}>Blocking: {code}</li>
                    ))}
                    {(readiness.warnings ?? []).map((code) => (
                      <li key={code}>Warning: {code}</li>
                    ))}
                  </ul>
                </section>
              )}
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
              {report.submission && (
                <section aria-label="Submitted version history">
                  <h4>Version history</h4>
                  <ul>
                    {(report.submission.versions ?? []).map((version) => (
                      <li key={version.id}>
                        Version {version.version}, submitted{' '}
                        {new Date(version.submittedAt).toLocaleString()}
                        {version.version === report.submission?.acceptedVersion
                          ? ' (accepted)'
                          : ''}
                        {version.resubmissionReason
                          ? ` — ${version.resubmissionReason}`
                          : ''}
                        {version.provenance === 'legacyBackfill'
                          ? ' — last recoverable legacy state; earlier attempts and original checksum unavailable'
                          : ' — native version; checksum recorded'}
                        <pre>{JSON.stringify(version.snapshot, null, 2)}</pre>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section aria-label="Reporting review notes">
                <h4>Review notes</h4>
                <ul>
                  {notes.map((note) => (
                    <li key={note.id}>
                      {note.body} — {note.authorUser.displayName}
                    </li>
                  ))}
                </ul>
                {report.submission && (
                  <>
                    <label>
                      Add note
                      <textarea
                        value={noteBody}
                        onChange={(event) => setNoteBody(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!noteBody.trim()}
                      onClick={() =>
                        void run(async () => {
                          await addSchoolReportingNote(
                            baseUrl,
                            schoolId,
                            report.reportingPeriodId,
                            noteBody,
                          )
                          setNoteBody('')
                        }, 'Note added.')
                      }
                    >
                      Add note
                    </button>
                  </>
                )}
              </section>
              <button
                type="button"
                disabled={
                  report.reportingPeriod.status !== 'open' ||
                  ['submitted', 'underReview', 'approved'].includes(
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
                  report.submission.status !== 'draft' ||
                  readiness?.ready !== true
                }
                onClick={() =>
                  void run(
                    () =>
                      submitReport(baseUrl, schoolId, report.reportingPeriodId),
                    'Report submitted.',
                  )
                }
              >
                Submit report
              </button>
              {report.submission?.status === 'returned' && (
                <>
                  <label>
                    Resubmission reason
                    <input
                      value={resubmissionReason}
                      onChange={(event) =>
                        setResubmissionReason(event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      resubmissionReason.trim().length < 3 ||
                      readiness?.ready !== true
                    }
                    onClick={() =>
                      void run(
                        () =>
                          resubmitReport(
                            baseUrl,
                            schoolId,
                            report.reportingPeriodId,
                            resubmissionReason,
                          ),
                        'Report resubmitted.',
                      )
                    }
                  >
                    Resubmit report
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
