import { useEffect, useState } from 'react'
import {
  saveAcademicMark,
  type AcademicContext,
  type Assessment,
} from './academicApi'
import {
  getCompleteness,
  getLock,
  getModeration,
  getReadiness,
  getWindow,
  lockGradebook,
  requestModeration,
  reviewModeration,
  unlockGradebook,
  type GradebookCompleteness,
  type ModerationRequest,
  type Readiness,
} from './gradebookApi'

export function GradebookWorkspace({
  baseUrl,
  schoolId,
  context,
  assessments,
  role,
}: {
  baseUrl: string
  schoolId: string
  context: AcademicContext
  assessments: Assessment[]
  role: 'administrator' | 'teacher' | 'approver'
}) {
  const [assessmentId, setAssessmentId] = useState('')
  const selectedId = assessments.some((item) => item.id === assessmentId)
    ? assessmentId
    : assessments[0]?.id || ''
  const [completeness, setCompleteness] =
    useState<GradebookCompleteness | null>(null)
  const [moderation, setModeration] = useState<ModerationRequest[]>([])
  const [windowStatus, setWindowStatus] = useState<string>('not configured')
  const [locked, setLocked] = useState(false)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [score, setScore] = useState<Record<string, string>>({})
  const [proposed, setProposed] = useState<Record<string, string>>({})
  const [reason, setReason] = useState<Record<string, string>>({})
  const [unlockReason, setUnlockReason] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!selectedId) return
    let active = true
    Promise.all([
      getCompleteness(baseUrl, schoolId, selectedId),
      getWindow(baseUrl, schoolId, selectedId),
      getModeration(baseUrl, schoolId, context),
      getLock(baseUrl, schoolId, context),
      getReadiness(baseUrl, schoolId, context),
    ])
      .then(
        ([
          nextCompleteness,
          nextWindow,
          nextModeration,
          nextLock,
          nextReadiness,
        ]) => {
          if (!active) return
          setCompleteness(nextCompleteness)
          setWindowStatus(nextWindow.window?.status ?? 'not configured')
          setModeration(nextModeration.requests)
          setLocked(nextLock.lock?.locked ?? false)
          setReadiness(nextReadiness)
        },
      )
      .catch(() => active && setError('Could not load gradebook controls.'))
    return () => {
      active = false
    }
  }, [
    baseUrl,
    schoolId,
    selectedId,
    context.academicYearId,
    context.gradingPeriodId,
    context.schoolClassId,
    context.subjectId,
    revision,
  ])

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }
  const current = assessments.find((item) => item.id === selectedId)
  return (
    <section className="academic-panel" aria-label="Gradebook controls">
      <h3>Gradebook</h3>
      <label>
        Assessment{' '}
        <select
          value={selectedId}
          onChange={(event) => setAssessmentId(event.target.value)}
        >
          {assessments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {!selectedId && (
        <p>No assessment is defined for this class, subject and period.</p>
      )}
      {selectedId && (
        <>
          <p>
            Entry window: {windowStatus}. Gradebook:{' '}
            {locked ? 'locked' : 'unlocked'}.
          </p>
          {completeness && (
            <>
              <p>
                Eligible: {completeness.counts.eligible}; entered:{' '}
                {completeness.counts.marksEntered}; missing:{' '}
                {completeness.counts.marksMissing}; absent:{' '}
                {completeness.counts.absent}; pending make-up:{' '}
                {completeness.counts.pendingMakeUp}.
              </p>
              <div className="academic-table-wrap">
                <table>
                  <caption>Assessment participation and marks</caption>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Participation</th>
                      <th>Mark</th>
                      <th>Validation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completeness.rows.map((row) => {
                      const markState = row.mark
                        ? Number(row.mark.score) === 0
                          ? 'Recorded zero'
                          : 'Recorded mark'
                        : 'Missing mark'
                      return (
                        <tr key={row.enrollmentId}>
                          <th scope="row">
                            {row.studentName} ({row.studentReference})
                          </th>
                          <td>
                            {row.participation ?? 'Not recorded'}
                            {row.makeUpStatus &&
                              ` · Make-up ${row.makeUpStatus}`}
                          </td>
                          <td>
                            {markState}
                            {row.mark &&
                              `: ${row.mark.score} / ${current?.maximumScore}`}
                          </td>
                          <td>
                            {row.issues.length
                              ? row.issues.join(', ')
                              : 'Complete'}
                          </td>
                          <td>
                            {!locked && role !== 'approver' && (
                              <>
                                <label>
                                  Score for {row.studentReference}
                                  <input
                                    inputMode="decimal"
                                    value={score[row.enrollmentId] ?? ''}
                                    onChange={(event) =>
                                      setScore({
                                        ...score,
                                        [row.enrollmentId]: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <button
                                  type="button"
                                  disabled={busy || !score[row.enrollmentId]}
                                  onClick={() =>
                                    void run(
                                      () =>
                                        saveAcademicMark(
                                          baseUrl,
                                          schoolId,
                                          row.enrollmentId,
                                          selectedId,
                                          score[row.enrollmentId] ?? '',
                                          row.mark?.id,
                                        ),
                                      'Mark saved.',
                                    )
                                  }
                                >
                                  Save mark
                                </button>
                                {row.mark && (
                                  <>
                                    <label>
                                      Proposed score for {row.studentReference}
                                      <input
                                        inputMode="decimal"
                                        value={proposed[row.mark.id] ?? ''}
                                        onChange={(event) =>
                                          setProposed({
                                            ...proposed,
                                            [row.mark!.id]: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Moderation reason for{' '}
                                      {row.studentReference}
                                      <input
                                        value={reason[row.mark.id] ?? ''}
                                        onChange={(event) =>
                                          setReason({
                                            ...reason,
                                            [row.mark!.id]: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      disabled={
                                        busy ||
                                        !proposed[row.mark.id] ||
                                        (reason[row.mark.id]?.length ?? 0) < 5
                                      }
                                      onClick={() =>
                                        void run(
                                          () =>
                                            requestModeration(
                                              baseUrl,
                                              schoolId,
                                              row.mark!.id,
                                              proposed[row.mark!.id] ?? '',
                                              reason[row.mark!.id] ?? '',
                                            ),
                                          'Moderation requested.',
                                        )
                                      }
                                    >
                                      Request moderation
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <h4>Moderation</h4>
          {moderation.length === 0 && <p>No moderation requests.</p>}
          <ul>
            {moderation.map((item) => (
              <li key={item.id}>
                Mark {item.markId}: {item.originalScore} → {item.proposedScore};{' '}
                {item.reason}; {item.status}.{' '}
                {item.correction &&
                  `History: ${item.correction.previousScore} → ${item.correction.newScore}.`}
                {item.status === 'pending' && role !== 'teacher' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            reviewModeration(
                              baseUrl,
                              schoolId,
                              item.id,
                              'approved',
                            ),
                          'Moderation approved.',
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            reviewModeration(
                              baseUrl,
                              schoolId,
                              item.id,
                              'rejected',
                            ),
                          'Moderation rejected.',
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
          <h4>Gradebook lock</h4>
          {role === 'administrator' &&
            (!locked ? (
              <button
                disabled={busy || !completeness?.complete}
                onClick={() =>
                  void run(
                    () => lockGradebook(baseUrl, schoolId, context),
                    'Gradebook locked.',
                  )
                }
              >
                Lock gradebook
              </button>
            ) : (
              <>
                <label>
                  Unlock reason
                  <input
                    value={unlockReason}
                    onChange={(event) => setUnlockReason(event.target.value)}
                  />
                </label>
                <button
                  disabled={busy || unlockReason.trim().length < 5}
                  onClick={() =>
                    void run(
                      () =>
                        unlockGradebook(
                          baseUrl,
                          schoolId,
                          context,
                          unlockReason,
                        ),
                      'Gradebook unlocked.',
                    )
                  }
                >
                  Unlock gradebook
                </button>
              </>
            ))}
          <h4>Publication readiness</h4>
          {readiness && (
            <>
              <p>
                {readiness.ready
                  ? 'Ready for existing result approval'
                  : 'Not ready for publication'}
                . Result status: {readiness.resultStatus}.
              </p>
              <ul>
                {readiness.blockingIssues.map((item, index) => (
                  <li key={`${item.code}-${index}`}>
                    {item.code}
                    {item.assessmentId &&
                      `: ${assessments.find((entry) => entry.id === item.assessmentId)?.name ?? item.assessmentId}`}
                  </li>
                ))}
              </ul>
              {readiness.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
