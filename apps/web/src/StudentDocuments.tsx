import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api'
import {
  cancelStudentDocument,
  getStudentDocumentWorkspace,
  requestStudentDocument,
  type StudentDocumentWorkspace,
} from './studentDocumentApi'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentDocumentWorkspace }

export function StudentDocuments({
  baseUrl,
  onSessionExpired,
}: {
  baseUrl: string
  onSessionExpired: () => void
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [year, setYear] = useState('')
  const [type, setType] = useState<'reportCard' | 'transcript'>('reportCard')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    getStudentDocumentWorkspace(baseUrl)
      .then((data) => {
        if (!active) return
        setState({ status: 'loaded', data })
        setYear((current) =>
          data.eligibleYears.some(
            (item) => `${item.schoolId}:${item.academicYearId}` === current,
          )
            ? current
            : data.eligibleYears[0]
              ? `${data.eligibleYears[0].schoolId}:${data.eligibleYears[0].academicYearId}`
              : '',
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired()
        else setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, onSessionExpired, refresh])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const selected =
      state.status === 'loaded'
        ? state.data.eligibleYears.find(
            (item) => `${item.schoolId}:${item.academicYearId}` === year,
          )
        : undefined
    if (!selected) return
    try {
      await requestStudentDocument(
        baseUrl,
        selected.schoolId,
        selected.academicYearId,
        type,
      )
      setRefresh((value) => value + 1)
      setMessage('Request submitted')
    } catch {
      setMessage('Could not submit request')
    }
  }
  async function cancel(id: string) {
    try {
      await cancelStudentDocument(baseUrl, id)
      setRefresh((value) => value + 1)
    } catch {
      setMessage('Could not cancel request')
    }
  }
  return (
    <section
      className="academic-panel"
      aria-labelledby="student-documents-heading"
    >
      <h3 id="student-documents-heading">Documents</h3>
      {state.status === 'loading' && <p>Loading documents…</p>}
      {state.status === 'error' && <p>Could not load documents.</p>}
      {state.status === 'loaded' && (
        <>
          {state.data.eligibleYears.length > 0 && (
            <form onSubmit={submit}>
              <label>
                School and academic year
                <select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                >
                  {state.data.eligibleYears.map((item) => (
                    <option
                      key={`${item.schoolId}:${item.academicYearId}`}
                      value={`${item.schoolId}:${item.academicYearId}`}
                    >
                      {item.school} — {item.academicYear}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Document type
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as 'reportCard' | 'transcript')
                  }
                >
                  <option value="reportCard">Report card</option>
                  <option value="transcript">Transcript</option>
                </select>
              </label>
              <button type="submit">Request document</button>
            </form>
          )}
          {state.data.requests.length === 0 ? (
            <p>No document requests yet.</p>
          ) : (
            <ul>
              {state.data.requests.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.documentType === 'reportCard'
                      ? 'Report card'
                      : 'Transcript'}
                  </strong>{' '}
                  — {item.status}
                  {item.status === 'rejected' && item.rejectionReason && (
                    <p>Reason: {item.rejectionReason}</p>
                  )}
                  {item.status === 'requested' && (
                    <button type="button" onClick={() => void cancel(item.id)}>
                      Cancel request
                    </button>
                  )}
                  {item.status === 'ready' && item.issuedDocumentId && (
                    <a
                      href={`${baseUrl}/schools/${item.schoolId}/documents/${item.issuedDocumentId}/download`}
                    >
                      Download PDF
                    </a>
                  )}
                  {item.status === 'ready' && item.verificationReference && (
                    <>
                      <p>
                        Verification reference: {item.verificationReference}
                      </p>
                      <a href={`/verify/${item.verificationReference}`}>
                        Verify document
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
