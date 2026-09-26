import { useEffect, useState, type ChangeEvent } from 'react'
import { ApiError } from './api'
import {
  applySchoolImport,
  cancelSchoolImport,
  downloadSchoolExport,
  getSchoolImport,
  listSchoolImports,
  uploadSchoolImport,
  validateSchoolImport,
  type ImportJob,
  type SchoolExportType,
} from './schoolOperationsApi'

export function SchoolOperationsWorkspace({
  baseUrl,
  schoolId,
  onApplied,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  onApplied: () => void
  onSessionExpired: () => void
}) {
  const [open, setOpen] = useState(false)
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [job, setJob] = useState<ImportJob | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  function failed(problem: unknown) {
    if (problem instanceof ApiError && problem.status === 401)
      onSessionExpired()
    setError(
      problem instanceof ApiError
        ? problem.message
        : 'School operation failed. Try again.',
    )
  }
  async function refreshJobs() {
    try {
      setJobs(await listSchoolImports(baseUrl, schoolId))
      setError('')
    } catch (problem) {
      failed(problem)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (!open) return
    setLoading(true)
    void refreshJobs()
  }, [open, baseUrl, schoolId])

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
    setAcknowledgeWarnings(false)
    setNotice('')
  }
  async function run(action: 'upload' | 'validate' | 'apply' | 'cancel') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let current: ImportJob
      if (action === 'upload' || action === 'validate') {
        if (
          !file ||
          !file.name.toLowerCase().endsWith('.csv') ||
          file.size > 1_000_000
        ) {
          setError('Select a CSV file no larger than 1 MB.')
          return
        }
        const csv = await file.text()
        current =
          action === 'upload'
            ? await uploadSchoolImport(baseUrl, schoolId, csv, file.name)
            : await validateSchoolImport(
                baseUrl,
                schoolId,
                job!.id,
                csv,
                file.name,
              )
        current = await getSchoolImport(baseUrl, schoolId, current.id)
        setAcknowledgeWarnings(false)
      } else if (action === 'apply') {
        const result = await applySchoolImport(
          baseUrl,
          schoolId,
          job!.id,
          acknowledgeWarnings,
        )
        current = await getSchoolImport(baseUrl, schoolId, result.job.id)
        setNotice(
          `${result.created.length} student registrations applied as draft enrollments.`,
        )
        onApplied()
      } else {
        current = await cancelSchoolImport(baseUrl, schoolId, job!.id)
        setNotice('Import cancelled.')
      }
      setJob(current)
      await refreshJobs()
    } catch (problem) {
      failed(problem)
    } finally {
      setBusy(false)
    }
  }
  async function openJob(id: string) {
    setBusy(true)
    try {
      setJob(await getSchoolImport(baseUrl, schoolId, id))
      setError('')
      setNotice('')
      setAcknowledgeWarnings(false)
    } catch (problem) {
      failed(problem)
    } finally {
      setBusy(false)
    }
  }
  async function exportFile(type: SchoolExportType) {
    setBusy(true)
    setError('')
    try {
      await downloadSchoolExport(baseUrl, schoolId, type)
    } catch (problem) {
      failed(problem)
    } finally {
      setBusy(false)
    }
  }
  const issues = job?.issues ?? []
  const hasErrors = issues.some((issue) => issue.severity === 'error')
  const hasWarnings = issues.some((issue) => issue.severity === 'warning')
  return (
    <section className="school-operations" aria-label="School operations">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        School operations
      </button>
      {open && (
        <div>
          <h2>Student imports</h2>
          <p>
            Use a CSV with givenName, academicYearId, and gradeLevelId headers.
            Optional fields include familyName, dateOfBirth, schoolClassId, and
            guardian details. Correct errors in the file, then revalidate.
          </p>
          <label htmlFor="student-import-file">Student registration CSV</label>
          <input
            id="student-import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void selectFile(event)}
          />
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void run('upload')}
          >
            Upload and validate
          </button>
          {job && (
            <section aria-label="Selected import">
              <h3>{job.originalFileName ?? 'Student import'}</h3>
              <p>
                Status: <strong>{job.status}</strong>. {job.validRows} valid,{' '}
                {job.invalidRows} invalid, {job.totalRows} total rows.
              </p>
              {issues.length > 0 && (
                <ul>
                  {issues.map((issue, index) => (
                    <li
                      key={`${issue.rowNumber}-${issue.code}-${index}`}
                      className={`status-${issue.severity}`}
                    >
                      Row {issue.rowNumber}: {issue.severity} — {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {job.status === 'validated' && !hasErrors && (
                <>
                  {hasWarnings && (
                    <label>
                      <input
                        type="checkbox"
                        checked={acknowledgeWarnings}
                        onChange={(event) =>
                          setAcknowledgeWarnings(event.target.checked)
                        }
                      />{' '}
                      I reviewed duplicate warnings and want to apply this
                      import.
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={busy || (hasWarnings && !acknowledgeWarnings)}
                    onClick={() => void run('apply')}
                  >
                    Apply import
                  </button>
                </>
              )}
              {job.status === 'invalid' && (
                <p>
                  Blocking errors prevent application. Correct the CSV and
                  revalidate.
                </p>
              )}
              {['validated', 'invalid', 'uploaded'].includes(job.status) && (
                <>
                  <button
                    type="button"
                    disabled={busy || !file}
                    onClick={() => void run('validate')}
                  >
                    Revalidate selected file
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run('cancel')}
                  >
                    Cancel import
                  </button>
                </>
              )}
            </section>
          )}
          <h3>Previous imports</h3>
          {loading && <p role="status">Loading imports</p>}
          {jobs.length === 0 && !loading && <p>No previous imports.</p>}
          <ul>
            {jobs.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void openJob(entry.id)}
                >
                  {entry.originalFileName ?? 'Student import'} · {entry.status}
                </button>
              </li>
            ))}
          </ul>
          <h2>School exports</h2>
          <p>
            Downloads contain only the named school data and are recorded in the
            audit history.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportFile('studentRoster')}
          >
            Export student roster
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportFile('approvedEnrollmentRoster')}
          >
            Export approved enrollment roster
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportFile('publishedResults')}
          >
            Export published results
          </button>
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
