import { useEffect, useState, type FormEvent } from 'react'
import type { StudentDetailResponse, StudentOptions } from '@warka/shared'
import { ApiError, getStudentOptions } from './api'
import {
  decideCorrection,
  getCorrections,
  requestEnrollmentCorrection,
  requestStudentCorrection,
  type EnrollmentCorrection,
  type StudentCorrection,
} from './correctionApi'

type Kind = 'student' | 'enrollment'
const label = (value: string | null) => value ?? 'None'

export function CorrectionWorkspace({
  baseUrl,
  schoolId,
  detail,
  canRequest,
  canApprove,
  canApproveIdentity,
  onSessionExpired,
  onApplied,
}: {
  baseUrl: string
  schoolId: string
  detail: StudentDetailResponse | null
  canRequest: boolean
  canApprove: boolean
  canApproveIdentity: boolean
  onSessionExpired: () => void
  onApplied: (studentId: string) => void
}) {
  const [studentRequests, setStudentRequests] = useState<StudentCorrection[]>(
    [],
  )
  const [enrollmentRequests, setEnrollmentRequests] = useState<
    EnrollmentCorrection[]
  >([])
  const [options, setOptions] = useState<StudentOptions | null>(null)
  const [field, setField] = useState<
    'givenName' | 'familyName' | 'dateOfBirth'
  >('givenName')
  const [proposedValue, setProposedValue] = useState('')
  const [enrollmentId, setEnrollmentId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [classId, setClassId] = useState('')
  const [reason, setReason] = useState('')
  const [reviewReason, setReviewReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const studentId = detail?.student.id

  useEffect(() => {
    if (!canRequest && !canApprove) return
    let active = true
    const query = new URLSearchParams({ take: '50' })
    if (studentId) query.set('studentId', studentId)
    getCorrections(baseUrl, schoolId, 'student', query)
      .then((page) => {
        if (active) setStudentRequests(page.items as StudentCorrection[])
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401)
            onSessionExpired()
          setError('Could not load correction history.')
        }
      })
    const enrollmentQuery = new URLSearchParams({ take: '50' })
    if (studentId) enrollmentQuery.set('studentId', studentId)
    getCorrections(baseUrl, schoolId, 'enrollment', enrollmentQuery)
      .then((page) => {
        if (active)
          setEnrollmentRequests(
            (page.items as EnrollmentCorrection[]).filter(
              (item) => !studentId || item.enrollment.student.id === studentId,
            ),
          )
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401)
            onSessionExpired()
          setError('Could not load correction history.')
        }
      })
    return () => {
      active = false
    }
  }, [
    baseUrl,
    schoolId,
    studentId,
    canRequest,
    canApprove,
    canApproveIdentity,
    refresh,
    onSessionExpired,
  ])

  useEffect(() => {
    if (!detail || !canRequest) return
    let active = true
    getStudentOptions(baseUrl, schoolId)
      .then((value) => {
        if (active) setOptions(value)
      })
      .catch((cause: unknown) => {
        if (active && cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, studentId, canRequest, onSessionExpired])

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!studentId || !canRequest) return
    setBusy(true)
    setError('')
    try {
      await requestStudentCorrection(baseUrl, schoolId, studentId, {
        field,
        proposedValue: proposedValue || null,
        reason,
      })
      setProposedValue('')
      setReason('')
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      setError('Could not request identity correction.')
    } finally {
      setBusy(false)
    }
  }

  async function submitEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canRequest || !enrollmentId || !gradeId) return
    setBusy(true)
    setError('')
    try {
      await requestEnrollmentCorrection(baseUrl, schoolId, enrollmentId, {
        proposedGradeLevelId: gradeId,
        proposedSchoolClassId: classId || null,
        reason,
      })
      setReason('')
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      setError('Could not request enrollment correction.')
    } finally {
      setBusy(false)
    }
  }

  async function decide(
    kind: Kind,
    id: string,
    decision: 'approve' | 'reject',
    affectedStudentId: string,
  ) {
    if (
      !canApprove ||
      (kind === 'student' && !canApproveIdentity) ||
      (decision === 'reject' && reviewReason.trim().length < 3)
    ) {
      setError('Enter a rejection reason of at least three characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await decideCorrection(
        baseUrl,
        schoolId,
        kind,
        id,
        decision,
        decision === 'reject' ? reviewReason : undefined,
      )
      setReviewReason('')
      setRefresh((value) => value + 1)
      if (decision === 'approve') onApplied(affectedStudentId)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      setError('Could not review correction. Refresh and try again.')
    } finally {
      setBusy(false)
    }
  }

  const currentEnrollment = detail?.enrollments.find(
    (item) => item.id === enrollmentId,
  )
  const availableClasses =
    options?.classes.filter(
      (item) =>
        item.academicYearId === currentEnrollment?.academicYearId &&
        item.gradeLevelId === gradeId,
    ) ?? []
  const visibleEnrollments = detail
    ? enrollmentRequests.filter(
        (item) => item.enrollment.student.id === studentId,
      )
    : enrollmentRequests
  const visibleStudents = detail
    ? studentRequests.filter((item) => item.studentId === studentId)
    : studentRequests

  return (
    <section
      aria-label={detail ? 'Record corrections' : 'Correction review queue'}
    >
      <h4>{detail ? 'Record corrections' : 'Correction review queue'}</h4>
      {detail && (
        <p>
          Official values are shown in the student record. Requested values
          below remain pending until approved.
        </p>
      )}
      {detail && canRequest && (
        <>
          <form
            aria-label="Request identity correction"
            onSubmit={(event) => void submitIdentity(event)}
          >
            <h5>Request identity correction</h5>
            <label>
              Field{' '}
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
                type={field === 'dateOfBirth' ? 'date' : 'text'}
                value={proposedValue}
                onChange={(event) => setProposedValue(event.target.value)}
                required={field === 'givenName'}
              />
            </label>
            <label>
              Reason{' '}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={500}
                required
              />
            </label>
            <button disabled={busy}>Request identity correction</button>
          </form>
          <form
            aria-label="Request enrollment correction"
            onSubmit={(event) => void submitEnrollment(event)}
          >
            <h5>Request enrollment correction</h5>
            <label>
              Enrollment{' '}
              <select
                value={enrollmentId}
                onChange={(event) => {
                  const id = event.target.value
                  setEnrollmentId(id)
                  setGradeId(
                    detail.enrollments.find((item) => item.id === id)
                      ?.gradeLevelId ?? '',
                  )
                  setClassId('')
                }}
                required
              >
                <option value="">Select enrollment</option>
                {detail.enrollments
                  .filter((item) => item.status === 'approved')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.academicYearId} · {item.gradeLevelId}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Proposed grade{' '}
              <select
                value={gradeId}
                onChange={(event) => {
                  setGradeId(event.target.value)
                  setClassId('')
                }}
                required
              >
                <option value="">Select grade</option>
                {options?.gradeLevels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proposed class{' '}
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="">No class</option>
                {availableClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reason{' '}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={500}
                required
              />
            </label>
            <button disabled={busy || !options}>
              Request enrollment correction
            </button>
          </form>
        </>
      )}
      <h5>{detail ? 'Correction history' : 'Pending corrections'}</h5>
      {canApprove && (
        <label>
          Rejection reason{' '}
          <input
            value={reviewReason}
            onChange={(event) => setReviewReason(event.target.value)}
          />
        </label>
      )}
      <ul>
        {visibleStudents
          .filter((item) => detail || item.status === 'pending')
          .map((item) => (
            <li key={item.id}>
              <strong>
                {item.student.givenName} {item.student.familyName} ·{' '}
                {item.field}
              </strong>{' '}
              · {item.status}
              <br />
              Previous official: {label(item.previousValue)} · Requested:{' '}
              {label(item.proposedValue)}
              <br />
              Reason: {item.reason} · Requested by:{' '}
              {item.requestedBy.displayName}
              {item.status === 'pending' && canApproveIdentity && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void decide('student', item.id, 'approve', item.studentId)
                    }
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void decide('student', item.id, 'reject', item.studentId)
                    }
                  >
                    Reject
                  </button>
                </>
              )}
            </li>
          ))}
        {visibleEnrollments
          .filter((item) => detail || item.status === 'pending')
          .map((item) => (
            <li key={item.id}>
              <strong>
                {item.enrollment.student.givenName}{' '}
                {item.enrollment.student.familyName} · Enrollment
              </strong>{' '}
              · {item.status}
              <br />
              Previous official grade/class: {item.previousGradeLevelId} /{' '}
              {label(item.previousSchoolClassId)} · Requested grade/class:{' '}
              {item.proposedGradeLevelId} / {label(item.proposedSchoolClassId)}
              <br />
              Reason: {item.reason} · Requested by:{' '}
              {item.requestedBy.displayName}
              {item.status === 'pending' && canApprove && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void decide(
                        'enrollment',
                        item.id,
                        'approve',
                        item.enrollment.student.id,
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void decide(
                        'enrollment',
                        item.id,
                        'reject',
                        item.enrollment.student.id,
                      )
                    }
                  >
                    Reject
                  </button>
                </>
              )}
            </li>
          ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
