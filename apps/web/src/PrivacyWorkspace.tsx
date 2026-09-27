import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api'
import {
  actOnPrivacyRequest,
  cancelPrivacyRequest,
  getOwnPrivacyRequest,
  getOwnPrivacyRequests,
  getPrivacySubjects,
  getStaffPrivacyRequests,
  submitPrivacyRequest,
  type PrivacyRequest,
  type PrivacySubject,
} from './privacyApi'

type Mode = 'requester' | 'staff'
export function PrivacyWorkspace({
  baseUrl,
  mode,
  schoolId,
  onSessionExpired,
}: {
  baseUrl: string
  mode: Mode
  schoolId?: string
  onSessionExpired: () => void
}) {
  const [subjects, setSubjects] = useState<PrivacySubject[]>([])
  const [requests, setRequests] = useState<PrivacyRequest[]>([])
  const [selected, setSelected] = useState('')
  const [type, setType] = useState<PrivacyRequest['type']>('access')
  const [details, setDetails] = useState('')
  const [field, setField] = useState<
    'givenName' | 'familyName' | 'dateOfBirth'
  >('givenName')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState<
    'parentPortalSharing' | 'publicDocumentVerification'
  >('parentPortalSharing')
  const [reason, setReason] = useState('')
  const [packageData, setPackageData] = useState<unknown>(null)
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (mode === 'staff' && schoolId) {
      getStaffPrivacyRequests(baseUrl, schoolId)
        .then((page) => {
          if (active) setRequests(page.items)
        })
        .catch((cause: unknown) => {
          if (active) handleError(cause)
        })
    } else if (mode === 'requester') {
      Promise.all([getPrivacySubjects(baseUrl), getOwnPrivacyRequests(baseUrl)])
        .then(([people, page]) => {
          if (active) {
            setSubjects(people)
            setRequests(page.items)
            setSelected((current) =>
              people.some(
                (person) =>
                  `${person.schoolId}:${person.studentId}` === current,
              )
                ? current
                : people[0]
                  ? `${people[0].schoolId}:${people[0].studentId}`
                  : '',
            )
          }
        })
        .catch((cause: unknown) => {
          if (active) handleError(cause)
        })
    }
    return () => {
      active = false
    }
  }, [baseUrl, mode, schoolId, refresh, onSessionExpired])

  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
    else
      setError('Could not complete the privacy request. Refresh and try again.')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const subject = subjects.find(
      (item) => `${item.schoolId}:${item.studentId}` === selected,
    )
    if (!subject) return
    setBusy(true)
    setError('')
    try {
      await submitPrivacyRequest(baseUrl, subject.schoolId, {
        studentId: subject.studentId,
        type,
        details,
        ...(type === 'correction'
          ? { correctionField: field, correctionValue: value || null }
          : {}),
        ...(type === 'restriction' ? { restrictionCategory: category } : {}),
      })
      setDetails('')
      setValue('')
      setRefresh((current) => current + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function act(
    requestId: string,
    action: 'review' | 'approve' | 'reject' | 'fulfill' | 'applyRestriction',
  ) {
    if (!schoolId) return
    setBusy(true)
    setError('')
    try {
      await actOnPrivacyRequest(baseUrl, schoolId, requestId, action, reason)
      setReason('')
      setRefresh((current) => current + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function openPackage(requestId: string) {
    try {
      const item = await getOwnPrivacyRequest(baseUrl, requestId)
      setPackageData(item.accessPackage)
    } catch (cause) {
      handleError(cause)
    }
  }

  const selectedSubject = subjects.find(
    (item) => `${item.schoolId}:${item.studentId}` === selected,
  )
  return (
    <section
      aria-label={
        mode === 'staff' ? 'Privacy request review' : 'My data requests'
      }
    >
      <h3>
        {mode === 'staff' ? 'Privacy request review' : 'My data requests'}
      </h3>
      <p>
        Requests are reviewed by school staff. Official record corrections
        follow a separate approval process.
      </p>
      {mode === 'requester' && (
        <>
          {subjects.length === 0 && (
            <p>
              No eligible student relationship is available for a new request.
            </p>
          )}
          {subjects.length > 0 && (
            <form
              aria-label="Submit data request"
              onSubmit={(event) => void submit(event)}
            >
              <label>
                Student{' '}
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {subjects.map((person) => (
                    <option
                      key={`${person.schoolId}:${person.studentId}`}
                      value={`${person.schoolId}:${person.studentId}`}
                    >
                      {person.displayName} · {person.studentReference} ·{' '}
                      {person.requesterKind}
                    </option>
                  ))}
                </select>
              </label>
              {selectedSubject && (
                <p>
                  Request concerns {selectedSubject.displayName} at school{' '}
                  {selectedSubject.schoolId}.
                </p>
              )}
              <label>
                Request type{' '}
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as PrivacyRequest['type'])
                  }
                >
                  <option value="access">Access</option>
                  <option value="correction">Correction</option>
                  <option value="restriction">Restriction</option>
                  <option value="objection">Objection</option>
                </select>
              </label>
              {type === 'correction' && (
                <>
                  <label>
                    Official field{' '}
                    <select
                      value={field}
                      onChange={(event) =>
                        setField(event.target.value as typeof field)
                      }
                    >
                      <option value="givenName">Given name</option>
                      <option value="familyName">Family name</option>
                      <option value="dateOfBirth">Date of birth</option>
                    </select>
                  </label>
                  <label>
                    Proposed value{' '}
                    <input
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  </label>
                </>
              )}
              {type === 'restriction' && (
                <>
                  <label>
                    Restriction category{' '}
                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value as typeof category)
                      }
                    >
                      <option value="parentPortalSharing">
                        Parent portal sharing
                      </option>
                      <option value="publicDocumentVerification">
                        Public document verification review
                      </option>
                    </select>
                  </label>
                  <p>
                    Parent portal sharing blocks parent portal access when
                    approved. Public document verification needs manual review
                    and does not automatically change issued documents.
                  </p>
                </>
              )}
              <label>
                Details{' '}
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
              <button disabled={busy}>Submit request</button>
            </form>
          )}
        </>
      )}
      {mode === 'staff' && (
        <label>
          Rejection reason{' '}
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      <h4>Request history</h4>
      {requests.length === 0 && <p>No requests found.</p>}
      <ul>
        {requests.map((item) => (
          <li key={item.id}>
            <strong>{item.type}</strong> · {item.status} ·{' '}
            {new Date(item.createdAt).toLocaleDateString()}
            {mode === 'staff' && (
              <p>
                Student {item.studentId} · Requester{' '}
                {'requester' in item &&
                typeof item.requester === 'object' &&
                item.requester !== null &&
                'displayName' in item.requester
                  ? String(item.requester.displayName)
                  : 'User'}{' '}
                · {item.details}
              </p>
            )}
            {item.type === 'correction' && item.officialCorrectionRequestId && (
              <p>
                Official correction request {item.officialCorrectionRequestId}{' '}
                awaits separate record review.
              </p>
            )}
            {item.type === 'restriction' && (
              <p>
                Category:{' '}
                {item.restrictionCategory === 'parentPortalSharing'
                  ? 'Parent portal sharing'
                  : 'Public document verification manual review'}
              </p>
            )}
            {mode === 'requester' &&
              item.status === 'fulfilled' &&
              item.type === 'access' && (
                <button onClick={() => void openPackage(item.id)}>
                  View access package
                </button>
              )}
            {mode === 'requester' &&
              ['submitted', 'underReview'].includes(item.status) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void cancelPrivacyRequest(baseUrl, item.id)
                      .then(() => setRefresh((current) => current + 1))
                      .catch(handleError)
                  }
                >
                  Cancel request
                </button>
              )}
            {mode === 'staff' && item.status === 'submitted' && (
              <button
                disabled={busy}
                onClick={() => void act(item.id, 'review')}
              >
                Start review
              </button>
            )}
            {mode === 'staff' &&
              ['submitted', 'underReview'].includes(item.status) && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void act(item.id, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => void act(item.id, 'reject')}
                  >
                    Reject
                  </button>
                </>
              )}
            {mode === 'staff' &&
              item.status === 'approved' &&
              item.type === 'access' && (
                <button
                  disabled={busy}
                  onClick={() => void act(item.id, 'fulfill')}
                >
                  Prepare access package
                </button>
              )}
          </li>
        ))}
      </ul>
      {packageData !== null && (
        <section aria-label="Access package">
          <h4>Access package</h4>
          <pre>{JSON.stringify(packageData, null, 2)}</pre>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
