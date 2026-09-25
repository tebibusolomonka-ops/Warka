import { useEffect, useState, type FormEvent } from 'react'
import type { StudentDocuments } from '@warka/shared'
import { ApiError } from './api'
import {
  actOnStudentDocument,
  getStudentDocuments,
  issueStudentDocument,
} from './documentApi'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentDocuments }

export function DocumentPanel({
  baseUrl,
  schoolId,
  studentId,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  studentId: string
  onSessionExpired: () => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [academicYearId, setAcademicYearId] = useState('')
  const [documentType, setDocumentType] = useState<'reportCard' | 'transcript'>(
    'reportCard',
  )
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    getStudentDocuments(baseUrl, schoolId, studentId)
      .then((data) => {
        if (!active) return
        setLoad({ status: 'loaded', data })
        setAcademicYearId((current) =>
          data.eligibleYears.some((year) => year.id === current)
            ? current
            : (data.eligibleYears[0]?.id ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired()
        else setLoad({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, studentId, refresh, onSessionExpired])

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!academicYearId) return
    setBusy(true)
    setMessage('')
    try {
      await issueStudentDocument(
        baseUrl,
        schoolId,
        studentId,
        academicYearId,
        documentType,
      )
      setMessage('Document issued.')
      setRefresh((value) => value + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setMessage('Could not issue document.')
    } finally {
      setBusy(false)
    }
  }

  async function act(documentId: string, action: 'correct' | 'withdraw') {
    const reason = reasons[documentId]?.trim()
    if (!reason || reason.length < 3) {
      setMessage('Enter a reason of at least three characters.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await actOnStudentDocument(baseUrl, schoolId, documentId, action, reason)
      setReasons((current) => ({ ...current, [documentId]: '' }))
      setMessage(
        action === 'correct' ? 'Document corrected.' : 'Document withdrawn.',
      )
      setRefresh((value) => value + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setMessage('Could not update document.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="academic-panel" aria-labelledby="documents-heading">
      <h4 id="documents-heading">Issued documents</h4>
      {load.status === 'loading' && <p role="status">Loading documents</p>}
      {load.status === 'error' && (
        <div role="alert">
          <p>Could not load documents.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {load.status === 'loaded' && (
        <>
          {load.data.eligibleYears.length > 0 ? (
            <form onSubmit={(event) => void issue(event)}>
              <label className="field">
                Academic year
                <select
                  value={academicYearId}
                  onChange={(event) => setAcademicYearId(event.target.value)}
                >
                  {load.data.eligibleYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Document type
                <select
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(
                      event.target.value as 'reportCard' | 'transcript',
                    )
                  }
                >
                  <option value="reportCard">Report card</option>
                  <option value="transcript">Transcript</option>
                </select>
              </label>
              <button type="submit" disabled={busy}>
                Issue document
              </button>
            </form>
          ) : (
            <p>
              Published results are required before a document can be issued.
            </p>
          )}
          {load.data.documents.length === 0 && <p>No issued documents yet.</p>}
          <ul>
            {load.data.documents.map((document) => {
              const prior = load.data.documents.find(
                (item) => item.id === document.supersedesId,
              )
              const replacement = load.data.documents.find(
                (item) => item.supersedesId === document.id,
              )
              return (
                <li key={document.id}>
                  <strong>
                    {document.documentType === 'reportCard'
                      ? 'Report card'
                      : 'Transcript'}
                  </strong>
                  {' � '}
                  {document.status}
                  {' � '}
                  {document.issuedAt.slice(0, 10)}
                  <p>
                    Verification reference: {document.verificationReference}
                  </p>
                  {prior && <p>Replaces {prior.verificationReference}</p>}
                  {replacement && (
                    <p>Replaced by {replacement.verificationReference}</p>
                  )}
                  <a
                    href={'/verify/' + document.verificationReference}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open public verification
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(document.verificationReference)
                        .then(() => setMessage('Reference copied.'))
                        .catch(() => setMessage('Could not copy reference.'))
                    }}
                  >
                    Copy reference
                  </button>
                  {document.status === 'active' && (
                    <div>
                      <label className="field">
                        Reason for {document.verificationReference}
                        <input
                          value={reasons[document.id] ?? ''}
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [document.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(document.id, 'correct')}
                      >
                        Correct document
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(document.id, 'withdraw')}
                      >
                        Withdraw document
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
