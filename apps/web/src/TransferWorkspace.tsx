import { useEffect, useState, type FormEvent } from 'react'
import type { TransferOptions, TransferView } from '@warka/shared'
import { ApiError } from './api'
import {
  actOnTransfer,
  createTransferRequest,
  getSchoolTransfers,
  getTransferDetail,
  getTransferOptions,
} from './transferApi'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'loaded'
      options: TransferOptions
      outgoing: TransferView[]
      incoming: TransferView[]
    }

export function TransferWorkspace({
  baseUrl,
  schoolId,
  schoolName,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  schoolName: string
  onSessionExpired: () => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [studentEnrollmentId, setStudentEnrollmentId] = useState('')
  const [receivingSchoolId, setReceivingSchoolId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [schoolClassId, setSchoolClassId] = useState('')
  const [selected, setSelected] = useState<TransferView | null>(null)
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>(
    'outgoing',
  )
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) onSessionExpired()
  }

  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    Promise.all([
      getTransferOptions(baseUrl, schoolId),
      getSchoolTransfers(baseUrl, schoolId, 'outgoing'),
      getSchoolTransfers(baseUrl, schoolId, 'incoming'),
    ])
      .then(([options, outgoing, incoming]) => {
        if (!active) return
        setLoad({ status: 'loaded', options, outgoing, incoming })
        setStudentEnrollmentId((value) =>
          options.eligibleStudents.some(
            (item) => item.sourceEnrollmentId === value,
          )
            ? value
            : (options.eligibleStudents[0]?.sourceEnrollmentId ?? ''),
        )
        setReceivingSchoolId((value) =>
          options.receivingSchools.some((item) => item.id === value)
            ? value
            : (options.receivingSchools[0]?.id ?? ''),
        )
        setAcademicYearId((value) =>
          options.academicYears.some((item) => item.id === value)
            ? value
            : (options.academicYears[0]?.id ?? ''),
        )
        setGradeLevelId((value) =>
          options.gradeLevels.some((item) => item.id === value)
            ? value
            : (options.gradeLevels[0]?.id ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        handleError(error)
        setLoad({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, refresh, onSessionExpired])

  async function open(
    transferId: string,
    selectedDirection: 'outgoing' | 'incoming',
  ) {
    setBusy(true)
    setMessage('')
    try {
      setSelected(await getTransferDetail(baseUrl, schoolId, transferId))
      setDirection(selectedDirection)
    } catch (error) {
      handleError(error)
      setMessage('Could not load transfer detail.')
    } finally {
      setBusy(false)
    }
  }

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (load.status !== 'loaded') return
    const source = load.options.eligibleStudents.find(
      (item) => item.sourceEnrollmentId === studentEnrollmentId,
    )
    if (!source || !receivingSchoolId) return
    setBusy(true)
    setMessage('')
    try {
      const created = await createTransferRequest(
        baseUrl,
        schoolId,
        source.studentId,
        source.sourceEnrollmentId,
        receivingSchoolId,
      )
      setSelected(created)
      setDirection('outgoing')
      setMessage('Transfer requested.')
      setRefresh((value) => value + 1)
    } catch (error) {
      handleError(error)
      setMessage('Could not request transfer.')
    } finally {
      setBusy(false)
    }
  }

  async function act(action: 'approve' | 'accept' | 'reject' | 'cancel') {
    if (!selected) return
    if (['reject', 'cancel'].includes(action) && reason.trim().length < 3) {
      setMessage('Enter a reason of at least three characters.')
      return
    }
    if (action === 'accept' && (!academicYearId || !gradeLevelId)) {
      setMessage('Choose a receiving academic year and grade.')
      return
    }
    const body =
      action === 'accept'
        ? { academicYearId, gradeLevelId, schoolClassId: schoolClassId || null }
        : ['reject', 'cancel'].includes(action)
          ? { reason: reason.trim() }
          : {}
    setBusy(true)
    setMessage('')
    try {
      const changed = await actOnTransfer(
        baseUrl,
        schoolId,
        selected.id,
        action,
        body,
      )
      setSelected(changed)
      setReason('')
      setMessage(
        action === 'approve'
          ? 'Transfer approved.'
          : action === 'accept'
            ? 'Transfer accepted.'
            : action === 'reject'
              ? 'Transfer rejected.'
              : 'Transfer cancelled.',
      )
      setRefresh((value) => value + 1)
    } catch (error) {
      handleError(error)
      setMessage('Could not update transfer.')
    } finally {
      setBusy(false)
    }
  }

  const source =
    load.status === 'loaded'
      ? load.options.eligibleStudents.find(
          (item) => item.sourceEnrollmentId === studentEnrollmentId,
        )
      : undefined
  const classes =
    load.status === 'loaded'
      ? load.options.classes.filter(
          (item) =>
            item.academicYearId === academicYearId &&
            item.gradeLevelId === gradeLevelId,
        )
      : []

  return (
    <section className="academic-panel" aria-labelledby="transfers-heading">
      <h2 id="transfers-heading">Transfers · {schoolName}</h2>
      {load.status === 'loading' && <p role="status">Loading transfers</p>}
      {load.status === 'error' && (
        <div role="alert">
          <p>Could not load transfers.</p>
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
          <h3>Request transfer</h3>
          {load.options.eligibleStudents.length === 0 && (
            <p>No approved source enrollments available.</p>
          )}
          {load.options.receivingSchools.length === 0 && (
            <p>No receiving schools available.</p>
          )}
          {load.options.eligibleStudents.length > 0 &&
            load.options.receivingSchools.length > 0 && (
              <form onSubmit={(event) => void request(event)}>
                <label className="field">
                  Student and source enrollment
                  <select
                    value={studentEnrollmentId}
                    onChange={(event) =>
                      setStudentEnrollmentId(event.target.value)
                    }
                  >
                    {load.options.eligibleStudents.map((item) => (
                      <option
                        key={item.sourceEnrollmentId}
                        value={item.sourceEnrollmentId}
                      >
                        {item.displayName} · {item.studentReference} ·{' '}
                        {item.academicYear} · {item.gradeLevel}
                      </option>
                    ))}
                  </select>
                </label>
                {source && (
                  <p>
                    Source: {source.academicYear} · {source.gradeLevel}
                  </p>
                )}
                <label className="field">
                  Receiving school
                  <select
                    value={receivingSchoolId}
                    onChange={(event) =>
                      setReceivingSchoolId(event.target.value)
                    }
                  >
                    {load.options.receivingSchools.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={busy}>
                  Request transfer
                </button>
              </form>
            )}
          <h3>Outgoing transfers</h3>
          {load.outgoing.length === 0 && <p>No outgoing transfers.</p>}
          <ul>
            {load.outgoing.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void open(item.id, 'outgoing')}
                >
                  Review outgoing transfer for {item.student.displayName}
                </button>
                {' · '}
                {item.status}
              </li>
            ))}
          </ul>
          <h3>Incoming transfers</h3>
          {load.incoming.length === 0 && <p>No incoming transfers.</p>}
          <ul>
            {load.incoming.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void open(item.id, 'incoming')}
                >
                  Review incoming transfer for {item.student.displayName}
                </button>
                {' · '}
                {item.status}
              </li>
            ))}
          </ul>
          {selected && (
            <section aria-labelledby="transfer-detail-heading">
              <h3 id="transfer-detail-heading">Transfer detail</h3>
              <p>
                {selected.student.displayName} ·{' '}
                {selected.student.studentReference}
              </p>
              <dl>
                <dt>Sending school</dt>
                <dd>{selected.sendingSchool}</dd>
                <dt>Receiving school</dt>
                <dd>{selected.receivingSchool}</dd>
                <dt>Transfer status</dt>
                <dd>{selected.status}</dd>
                <dt>Source enrollment</dt>
                <dd>
                  {selected.sourceEnrollment.academicYear} ·{' '}
                  {selected.sourceEnrollment.gradeLevel}
                  {' · '}
                  {selected.sourceEnrollment.status}
                  {selected.sourceEnrollment.schoolClass &&
                    ' · ' + selected.sourceEnrollment.schoolClass}
                </dd>
                <dt>Requested</dt>
                <dd>{selected.requestedAt.slice(0, 10)}</dd>
                {selected.sendingApprovedAt && (
                  <>
                    <dt>Sending approved</dt>
                    <dd>{selected.sendingApprovedAt.slice(0, 10)}</dd>
                  </>
                )}
                {selected.receivingEnrollment && (
                  <>
                    <dt>New receiving enrollment</dt>
                    <dd>
                      {selected.receivingEnrollment.academicYear} ·{' '}
                      {selected.receivingEnrollment.gradeLevel}
                      {' · '}
                      {selected.receivingEnrollment.status}
                    </dd>
                  </>
                )}
                {selected.completedAt && (
                  <>
                    <dt>Completed</dt>
                    <dd>{selected.completedAt.slice(0, 10)}</dd>
                  </>
                )}
              </dl>
              {selected.rejectionReason && (
                <p>Rejection reason: {selected.rejectionReason}</p>
              )}
              {selected.cancellationReason && (
                <p>Cancellation reason: {selected.cancellationReason}</p>
              )}
              {direction === 'outgoing' && selected.status === 'requested' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('approve')}
                >
                  Approve sending transfer
                </button>
              )}
              {direction === 'incoming' &&
                selected.status === 'approvedBySendingSchool' && (
                  <>
                    <fieldset>
                      <legend>Receiving enrollment</legend>
                      <label className="field">
                        Academic year
                        <select
                          value={academicYearId}
                          onChange={(event) => {
                            setAcademicYearId(event.target.value)
                            setSchoolClassId('')
                          }}
                        >
                          {load.options.academicYears.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Grade level
                        <select
                          value={gradeLevelId}
                          onChange={(event) => {
                            setGradeLevelId(event.target.value)
                            setSchoolClassId('')
                          }}
                        >
                          {load.options.gradeLevels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Class (optional)
                        <select
                          value={schoolClassId}
                          onChange={(event) =>
                            setSchoolClassId(event.target.value)
                          }
                        >
                          <option value="">Not assigned</option>
                          {classes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </fieldset>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('accept')}
                    >
                      Accept transfer
                    </button>
                  </>
                )}
              {((direction === 'incoming' &&
                selected.status === 'approvedBySendingSchool') ||
                (direction === 'outgoing' &&
                  ['requested', 'approvedBySendingSchool'].includes(
                    selected.status,
                  ))) && (
                <>
                  <label className="field">
                    Decision reason
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  {direction === 'incoming' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('reject')}
                    >
                      Reject transfer
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('cancel')}
                    >
                      Cancel transfer
                    </button>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
