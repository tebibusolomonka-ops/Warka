import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api'
import { actOnStudentDocument } from './documentApi'
import {
  actOnSchoolDocumentRequest,
  getSchoolDocumentProfile,
  getSchoolDocumentRequest,
  listSchoolDocumentRequests,
  listSchoolIssuedDocuments,
  saveSchoolDocumentProfile,
  type SchoolDocumentRequest,
  type SchoolIssuedDocument,
  type SchoolDocumentProfile,
} from './schoolDocumentApi'

export function SchoolDocuments({
  baseUrl,
  schoolId,
  canRegister,
  canApprove,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  canRegister: boolean
  canApprove: boolean
  onSessionExpired: () => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [requests, setRequests] = useState<SchoolDocumentRequest[]>([])
  const [documents, setDocuments] = useState<SchoolIssuedDocument[]>([])
  const [selected, setSelected] = useState<SchoolDocumentRequest | null>(null)
  const [profile, setProfile] = useState<SchoolDocumentProfile | null>(null)
  const [officialName, setOfficialName] = useState('')
  const [footer, setFooter] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!open) return
    let active = true
    Promise.all([
      listSchoolDocumentRequests(baseUrl, schoolId, filter),
      listSchoolIssuedDocuments(baseUrl, schoolId),
      canRegister
        ? getSchoolDocumentProfile(baseUrl, schoolId)
        : Promise.resolve(null),
    ])
      .then(([items, issued, schoolProfile]) => {
        if (!active) return
        setRequests(items)
        setDocuments(issued)
        setProfile(schoolProfile)
        setOfficialName(schoolProfile?.officialName ?? '')
        setFooter(schoolProfile?.documentFooter ?? '')
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired()
        else setMessage('Could not load documents')
      })
    return () => {
      active = false
    }
  }, [open, baseUrl, schoolId, filter, refresh, canRegister, onSessionExpired])
  async function openRequest(id: string) {
    try {
      setSelected(await getSchoolDocumentRequest(baseUrl, schoolId, id))
      setReason('')
    } catch {
      setMessage('Could not open request')
    }
  }
  async function act(action: 'start' | 'issue' | 'reject') {
    if (!selected) return
    try {
      await actOnSchoolDocumentRequest(
        baseUrl,
        schoolId,
        selected.id,
        action,
        reason,
      )
      setSelected(null)
      setReason('')
      setRefresh((value) => value + 1)
      setMessage(
        action === 'issue'
          ? 'Official document issued'
          : action === 'reject'
            ? 'Request rejected'
            : 'Processing started',
      )
    } catch {
      setMessage('Could not update request')
    }
  }
  async function updateDocument(id: string, action: 'correct' | 'withdraw') {
    try {
      await actOnStudentDocument(baseUrl, schoolId, id, action, reason)
      setReason('')
      setRefresh((value) => value + 1)
      setMessage(`Document ${action === 'correct' ? 'corrected' : 'withdrawn'}`)
    } catch {
      setMessage('Could not update document')
    }
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    try {
      const value = await saveSchoolDocumentProfile(baseUrl, schoolId, {
        officialName: officialName || null,
        documentFooter: footer || null,
      })
      setProfile(value)
      setMessage('Document profile saved')
    } catch {
      setMessage('Could not save document profile')
    }
  }
  return (
    <section className="academic-panel" aria-label="School documents">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Documents
      </button>
      {open && (
        <>
          <h3>Official document requests</h3>
          <label>
            Status filter
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">All</option>
              {(
                [
                  'requested',
                  'processing',
                  'ready',
                  'rejected',
                  'cancelled',
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          {requests.length === 0 ? (
            <p>No document requests.</p>
          ) : (
            <ul>
              {requests.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openRequest(item.id)}
                  >
                    {item.student} —{' '}
                    {item.documentType === 'reportCard'
                      ? 'Report card'
                      : 'Transcript'}{' '}
                    — {item.status}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <div>
              <h4>Request details</h4>
              <p>
                {selected.student} · {selected.studentReference} ·{' '}
                {selected.academicYear}
              </p>
              <p>Status: {selected.status}</p>
              {selected.rejectionReason && (
                <p>Reason: {selected.rejectionReason}</p>
              )}
              {selected.status === 'requested' && (
                <button type="button" onClick={() => void act('start')}>
                  Start processing
                </button>
              )}
              {canApprove && selected.status === 'processing' && (
                <button type="button" onClick={() => void act('issue')}>
                  Issue official document
                </button>
              )}
              {canApprove &&
                ['requested', 'processing'].includes(selected.status) && (
                  <>
                    <label>
                      Reason
                      <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={reason.trim().length < 3}
                      onClick={() => void act('reject')}
                    >
                      Reject request
                    </button>
                  </>
                )}
            </div>
          )}
          <h3>Issued document history</h3>
          {documents.length === 0 ? (
            <p>No issued documents.</p>
          ) : (
            <ul>
              {documents.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.documentType === 'reportCard'
                      ? 'Report card'
                      : 'Transcript'}
                  </strong>{' '}
                  — {item.status} — {item.issuedAt.slice(0, 10)}
                  <p>Verification reference: {item.verificationReference}</p>
                  <a
                    href={`${baseUrl}/schools/${schoolId}/documents/${item.id}/download`}
                  >
                    Download PDF
                  </a>{' '}
                  <a href={`/verify/${item.verificationReference}`}>
                    Verify document
                  </a>
                  {canApprove && item.status === 'active' && (
                    <>
                      <label>
                        Reason
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={reason.trim().length < 3}
                        onClick={() => void updateDocument(item.id, 'correct')}
                      >
                        Correct
                      </button>
                      <button
                        type="button"
                        disabled={reason.trim().length < 3}
                        onClick={() => void updateDocument(item.id, 'withdraw')}
                      >
                        Withdraw
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <h3>Document profile</h3>
          {canRegister ? (
            <p>
              {profile?.officialName
                ? `Configured: ${profile.officialName}`
                : 'School document profile is not configured.'}
            </p>
          ) : (
            <p>School administrators manage the document profile.</p>
          )}
          {canRegister && canApprove && (
            <form onSubmit={saveProfile}>
              <label>
                Official school name
                <input
                  value={officialName}
                  onChange={(event) => setOfficialName(event.target.value)}
                />
              </label>
              <label>
                Document footer
                <input
                  value={footer}
                  onChange={(event) => setFooter(event.target.value)}
                />
              </label>
              <button type="submit">Save document profile</button>
            </form>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  )
}
