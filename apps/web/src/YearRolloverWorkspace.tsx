import { useEffect, useState } from 'react'
import type { StudentOptions } from '@warka/shared'
import { ApiError, getStudentOptions } from './api'
import {
  applyRollover,
  bulkDecideRollover,
  bulkPromoteRollover,
  completeYearClosing,
  createRolloverPlan,
  getRolloverPlan,
  getYearReadiness,
  previewRollover,
  refreshRolloverExceptions,
  resolveRolloverException,
  reviewRollover,
  startYearClosing,
  type RolloverException,
  type RolloverPlan,
  type RolloverPreview,
  type RolloverReadiness,
  type RolloverResult,
} from './rolloverApi'

export function YearRolloverWorkspace({
  baseUrl,
  schoolId,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  onSessionExpired: () => void
}) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<StudentOptions | null>(null)
  const [sourceYearId, setSourceYearId] = useState('')
  const [targetYearId, setTargetYearId] = useState('')
  const [sourceGradeId, setSourceGradeId] = useState('')
  const [sourceClassId, setSourceClassId] = useState('')
  const [targetGradeId, setTargetGradeId] = useState('')
  const [targetClassId, setTargetClassId] = useState('')
  const [readiness, setReadiness] = useState<RolloverReadiness | null>(null)
  const [plan, setPlan] = useState<RolloverPlan | null>(null)
  const [preview, setPreview] = useState<RolloverPreview | null>(null)
  const [exceptions, setExceptions] = useState<RolloverException[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const [result, setResult] = useState<RolloverResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function failed(error: unknown) {
    if (error instanceof ApiError && error.status === 401) onSessionExpired()
    setMessage(
      error instanceof ApiError ? error.message : 'Rollover action failed',
    )
  }
  useEffect(() => {
    if (!open) return
    let active = true
    getStudentOptions(baseUrl, schoolId)
      .then((value) => {
        if (!active) return
        setOptions(value)
        setSourceYearId((current) =>
          value.academicYears.some((item) => item.id === current)
            ? current
            : (value.academicYears[0]?.id ?? ''),
        )
        setTargetYearId((current) =>
          value.academicYears.some((item) => item.id === current)
            ? current
            : (value.academicYears[1]?.id ?? ''),
        )
        setSourceGradeId((current) =>
          value.gradeLevels.some((item) => item.id === current)
            ? current
            : (value.gradeLevels[0]?.id ?? ''),
        )
        setTargetGradeId((current) =>
          value.gradeLevels.some((item) => item.id === current)
            ? current
            : (value.gradeLevels[0]?.id ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (active) failed(error)
      })
    return () => {
      active = false
    }
  }, [open, baseUrl, schoolId])
  useEffect(() => {
    if (!open || !sourceYearId) return
    let active = true
    getYearReadiness(baseUrl, schoolId, sourceYearId)
      .then((value) => {
        if (active) setReadiness(value)
      })
      .catch((error: unknown) => {
        if (active) failed(error)
      })
    return () => {
      active = false
    }
  }, [open, baseUrl, schoolId, sourceYearId])
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setMessage('')
    try {
      await action()
      setMessage(success)
    } catch (error) {
      failed(error)
    } finally {
      setBusy(false)
    }
  }
  async function loadPlan(id: string) {
    const value = await getRolloverPlan(baseUrl, schoolId, id)
    setPlan(value)
    setSelected([])
    return value
  }
  async function refreshPreview(id: string) {
    const value = await previewRollover(baseUrl, schoolId, id)
    setPreview(value)
    setExceptions(await refreshRolloverExceptions(baseUrl, schoolId, id))
  }
  const sourceClasses =
    options?.classes.filter(
      (item) =>
        item.academicYearId === sourceYearId &&
        item.gradeLevelId === sourceGradeId,
    ) ?? []
  const targetClasses =
    options?.classes.filter(
      (item) =>
        item.academicYearId === targetYearId &&
        item.gradeLevelId === targetGradeId,
    ) ?? []
  const currentClassId = targetClasses.some((item) => item.id === targetClassId)
    ? targetClassId
    : (targetClasses[0]?.id ?? '')
  const currentSourceClassId = sourceClasses.some(
    (item) => item.id === sourceClassId,
  )
    ? sourceClassId
    : ''
  const activeExceptions = exceptions.filter((item) => item.status === 'open')
  return (
    <section className="academic-panel" aria-label="Year rollover">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Year rollover
      </button>
      {open && (
        <>
          <h2>Year rollover</h2>
          {!options && <p>Loading academic years…</p>}
          {options && (
            <>
              <label>
                Source academic year
                <select
                  value={sourceYearId}
                  onChange={(event) => {
                    setSourceYearId(event.target.value)
                    setPlan(null)
                    setPreview(null)
                    setResult(null)
                  }}
                >
                  {options.academicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target academic year
                <select
                  value={targetYearId}
                  onChange={(event) => {
                    setTargetYearId(event.target.value)
                    setPlan(null)
                    setPreview(null)
                    setResult(null)
                  }}
                >
                  {options.academicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {readiness && (
                <div>
                  <h3>Closing readiness</h3>
                  <p>Source year: {readiness.status}</p>
                  {readiness.blockers.length ? (
                    <ul>
                      {readiness.blockers.map((item) => (
                        <li key={item.kind}>
                          {item.kind}: {item.count}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No closing blockers.</p>
                  )}
                  {readiness.status === 'active' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await startYearClosing(
                            baseUrl,
                            schoolId,
                            sourceYearId,
                          )
                          setReadiness(
                            await getYearReadiness(
                              baseUrl,
                              schoolId,
                              sourceYearId,
                            ),
                          )
                        }, 'Closing started')
                      }
                    >
                      Start closing
                    </button>
                  )}
                  {readiness.canClose && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await completeYearClosing(
                            baseUrl,
                            schoolId,
                            sourceYearId,
                          )
                          setReadiness(
                            await getYearReadiness(
                              baseUrl,
                              schoolId,
                              sourceYearId,
                            ),
                          )
                        }, 'Academic year closed')
                      }
                    >
                      Complete closing
                    </button>
                  )}
                </div>
              )}
              {!plan && (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !sourceYearId ||
                    !targetYearId ||
                    sourceYearId === targetYearId
                  }
                  onClick={() =>
                    void run(async () => {
                      const value = await createRolloverPlan(
                        baseUrl,
                        schoolId,
                        sourceYearId,
                        targetYearId,
                      )
                      setPlan(value)
                      setPreview(null)
                      setResult(null)
                    }, 'Progression plan created')
                  }
                >
                  Create progression plan
                </button>
              )}
              {plan && (
                <>
                  <h3>Student progression</h3>
                  <p>Plan status: {plan.status}</p>
                  {plan.entries.length === 0 ? (
                    <p>No eligible source enrollments.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Select</th>
                          <th>Student</th>
                          <th>Decision</th>
                          <th>Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.entries.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${item.student.studentReference}`}
                                checked={selected.includes(item.id)}
                                onChange={(event) =>
                                  setSelected((current) =>
                                    event.target.checked
                                      ? [...current, item.id]
                                      : current.filter((id) => id !== item.id),
                                  )
                                }
                              />
                            </td>
                            <td>
                              {item.student.givenName}{' '}
                              {item.student.familyName ?? ''}
                              <br />
                              {item.student.studentReference}
                            </td>
                            <td>{item.action}</td>
                            <td>
                              {options.gradeLevels.find(
                                (grade) => grade.id === item.targetGradeLevelId,
                              )?.name ?? 'Needs decision'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {plan.status === 'draft' && (
                    <>
                      <h4>Bulk preparation</h4>
                      <label>
                        Source grade
                        <select
                          value={sourceGradeId}
                          onChange={(event) => {
                            setSourceGradeId(event.target.value)
                            setSourceClassId('')
                          }}
                        >
                          {options.gradeLevels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Source class
                        <select
                          value={currentSourceClassId}
                          onChange={(event) =>
                            setSourceClassId(event.target.value)
                          }
                        >
                          <option value="">All classes</option>
                          {sourceClasses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Target grade
                        <select
                          value={targetGradeId}
                          onChange={(event) => {
                            setTargetGradeId(event.target.value)
                            setTargetClassId('')
                          }}
                        >
                          {options.gradeLevels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Target class
                        <select
                          value={currentClassId}
                          onChange={(event) =>
                            setTargetClassId(event.target.value)
                          }
                        >
                          <option value="">No class</option>
                          {targetClasses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={busy || !sourceGradeId || !targetGradeId}
                        onClick={() =>
                          void run(async () => {
                            await bulkPromoteRollover(
                              baseUrl,
                              schoolId,
                              plan.id,
                              {
                                sourceGradeLevelId: sourceGradeId,
                                sourceSchoolClassId:
                                  currentSourceClassId || null,
                                targetGradeLevelId: targetGradeId,
                                targetSchoolClassId: currentClassId || null,
                              },
                            )
                            await loadPlan(plan.id)
                            setPreview(null)
                          }, 'Promotions prepared')
                        }
                      >
                        Prepare promotions
                      </button>
                      <button
                        type="button"
                        disabled={busy || selected.length === 0}
                        onClick={() =>
                          void run(async () => {
                            await bulkDecideRollover(
                              baseUrl,
                              schoolId,
                              plan.id,
                              {
                                entryIds: selected,
                                action: 'repeat',
                                targetGradeLevelId: targetGradeId,
                                targetSchoolClassId: currentClassId || null,
                              },
                            )
                            await loadPlan(plan.id)
                            setPreview(null)
                          }, 'Repeat decisions saved')
                        }
                      >
                        Repeat selected
                      </button>
                      <button
                        type="button"
                        disabled={busy || selected.length === 0}
                        onClick={() =>
                          void run(async () => {
                            await bulkDecideRollover(
                              baseUrl,
                              schoolId,
                              plan.id,
                              { entryIds: selected, action: 'withdraw' },
                            )
                            await loadPlan(plan.id)
                            setPreview(null)
                          }, 'Withdrawal decisions saved')
                        }
                      >
                        Withdraw selected
                      </button>
                      <button
                        type="button"
                        disabled={busy || selected.length === 0}
                        onClick={() =>
                          void run(async () => {
                            await bulkDecideRollover(
                              baseUrl,
                              schoolId,
                              plan.id,
                              { entryIds: selected, action: 'manualReview' },
                            )
                            await loadPlan(plan.id)
                            setPreview(null)
                          }, 'Manual review selected')
                        }
                      >
                        Manual review selected
                      </button>
                    </>
                  )}
                  {plan.status !== 'applied' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await refreshPreview(plan.id)
                        }, 'Preview refreshed')
                      }
                    >
                      Validate and preview
                    </button>
                  )}
                  {preview && (
                    <div>
                      <h4>Validation preview</h4>
                      <p>
                        Promote: {preview.counts.promote}; Repeat:{' '}
                        {preview.counts.repeat}; Withdraw:{' '}
                        {preview.counts.withdraw}; Manual review:{' '}
                        {preview.counts.manualReview}; Blocking errors:{' '}
                        {preview.blockingErrors}
                      </p>
                      {preview.problems.length > 0 && (
                        <ul>
                          {preview.problems.map((problem, index) => (
                            <li
                              key={`${problem.entryId ?? 'plan'}-${problem.code}-${index}`}
                            >
                              {problem.code}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {exceptions.length > 0 && (
                    <div>
                      <h4>Progression exceptions</h4>
                      <ul>
                        {exceptions.map((item) => (
                          <li key={item.id}>
                            {item.kind} — {item.status}
                            {item.status === 'open' && (
                              <button
                                type="button"
                                disabled={
                                  busy || resolutionNote.trim().length < 3
                                }
                                onClick={() =>
                                  void run(async () => {
                                    await resolveRolloverException(
                                      baseUrl,
                                      schoolId,
                                      plan.id,
                                      item.id,
                                      resolutionNote,
                                    )
                                    await refreshPreview(plan.id)
                                  }, 'Exception resolved')
                                }
                              >
                                Resolve after correction
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <label>
                        Resolution note
                        <input
                          value={resolutionNote}
                          onChange={(event) =>
                            setResolutionNote(event.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                  {plan.status === 'draft' && preview && (
                    <>
                      <label>
                        <input
                          type="checkbox"
                          checked={reviewConfirmed}
                          onChange={(event) =>
                            setReviewConfirmed(event.target.checked)
                          }
                        />
                        I reviewed every progression decision
                      </label>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !reviewConfirmed ||
                          preview.blockingErrors > 0 ||
                          activeExceptions.length > 0
                        }
                        onClick={() =>
                          void run(async () => {
                            await reviewRollover(baseUrl, schoolId, plan.id)
                            await loadPlan(plan.id)
                          }, 'Plan reviewed')
                        }
                      >
                        Confirm review
                      </button>
                    </>
                  )}
                  {plan.status === 'reviewed' && (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !preview ||
                        preview.blockingErrors > 0 ||
                        activeExceptions.length > 0
                      }
                      onClick={() =>
                        void run(async () => {
                          const value = await applyRollover(
                            baseUrl,
                            schoolId,
                            plan.id,
                          )
                          setResult(value)
                          await loadPlan(plan.id)
                        }, 'Rollover applied')
                      }
                    >
                      Apply rollover
                    </button>
                  )}
                  {result && (
                    <div role="status">
                      <h4>Rollover result</h4>
                      <p>
                        New enrollments: {result.newEnrollments}; Promotions:{' '}
                        {result.promotions}; Repeats: {result.repeats};
                        Withdrawal decisions: {result.withdrawalDecisions}.
                      </p>
                      <p>
                        {result.sourceEnrollmentsPreserved} source-year
                        enrollment records preserved.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  )
}
