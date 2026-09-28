import { useEffect, useState } from 'react'
import type { AcademicStructure, TeachingAssignment } from './academicApi'
import { ApiError } from './api'
import {
  createTeacherCoursework,
  editTeacherCoursework,
  getTeacherCoursework,
  getTeacherCourseworkAudience,
  getTeacherCourseworkCounts,
  grantTeacherCourseworkExtension,
  getTeacherSubmission,
  getTeacherRubric,
  listTeacherSubmissions,
  reviewTeacherRevision,
  saveTeacherRubric,
  scoreTeacherRevision,
  saveTeacherFeedback,
  releaseTeacherFeedback,
  listTeacherCoursework,
  transitionTeacherCoursework,
  uploadTeacherCoursework,
  type CourseworkAssignment,
  type CourseworkAttachment,
  type CourseworkAudience,
  type CourseworkCounts,
  type StaffCourseworkDetail,
  type StaffCourseworkSubmission,
  type CourseworkRubric,
} from './courseworkApi'

export function TeacherCourseworkWorkspace({
  baseUrl,
  schoolId,
  structure,
  teachingAssignments,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  structure: AcademicStructure
  teachingAssignments: TeachingAssignment[]
  onSessionExpired: () => void
}) {
  const [items, setItems] = useState<CourseworkAssignment[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<{
    assignment: CourseworkAssignment
    attachments: CourseworkAttachment[]
  } | null>(null)
  const [counts, setCounts] = useState<CourseworkCounts | null>(null)
  const [audience, setAudience] = useState<CourseworkAudience>([])
  const [contextId, setContextId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [extensionStudentId, setExtensionStudentId] = useState('')
  const [extensionDueAt, setExtensionDueAt] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selectedContext =
    teachingAssignments.find((item) => item.id === contextId) ??
    teachingAssignments[0]
  const periods = structure.gradingPeriods.filter(
    (item) => item.academicYearId === selectedContext?.academicYearId,
  )
  const activePeriod = periods.find((item) => item.id === periodId)

  useEffect(() => {
    let active = true
    listTeacherCoursework(baseUrl, schoolId)
      .then((result) => {
        if (active) setItems(result.assignments)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setError('Could not load coursework assignments.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, refresh, onSessionExpired])
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setCounts(null)
      setAudience([])
      return
    }
    let active = true
    Promise.all([
      getTeacherCoursework(baseUrl, schoolId, selectedId),
      getTeacherCourseworkCounts(baseUrl, schoolId, selectedId),
      getTeacherCourseworkAudience(baseUrl, schoolId, selectedId),
    ])
      .then(([nextDetail, nextCounts, nextAudience]) => {
        if (active) {
          setDetail(nextDetail)
          setCounts(nextCounts)
          setAudience(nextAudience.students)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401)
            onSessionExpired()
          else setError('Could not load the selected assignment.')
        }
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, selectedId, refresh, onSessionExpired])
  useEffect(() => {
    if (!detail) return
    setTitle(detail.assignment.title)
    setInstructions(detail.assignment.instructions)
    setDueAt(detail.assignment.dueAt.slice(0, 16))
  }, [detail])

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else
        setError(
          cause instanceof Error ? cause.message : 'Coursework action failed.',
        )
    } finally {
      setBusy(false)
    }
  }
  const current = detail?.assignment
  return (
    <section
      className="academic-panel"
      aria-labelledby="teacher-coursework-heading"
    >
      <h3 id="teacher-coursework-heading">Coursework assignments</h3>
      <p>
        Assignments stay separate from official marks. Not submitted is an
        operational count, not a grade.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {structure.role === 'teacher' && selectedContext && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              const created = await createTeacherCoursework(baseUrl, schoolId, {
                academicYearId: selectedContext.academicYearId,
                schoolClassId: selectedContext.schoolClassId,
                subjectId: selectedContext.subjectId,
                ...(activePeriod ? { gradingPeriodId: activePeriod.id } : {}),
                title,
                instructions,
                dueAt: new Date(dueAt).toISOString(),
              })
              setSelectedId(created.id)
            }, 'Draft assignment created.')
          }}
        >
          <h4>Create draft</h4>
          <label>
            Class and subject{' '}
            <select
              value={selectedContext.id}
              onChange={(event) => {
                setContextId(event.target.value)
                setPeriodId('')
              }}
            >
              {teachingAssignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {structure.classes.find(
                    (schoolClass) => schoolClass.id === item.schoolClassId,
                  )?.name ?? 'Class'}{' '}
                  ·{' '}
                  {structure.subjects.find(
                    (subject) => subject.id === item.subjectId,
                  )?.name ?? 'Subject'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grading period{' '}
            <select
              value={activePeriod?.id ?? ''}
              onChange={(event) => setPeriodId(event.target.value)}
            >
              <option value="">No grading period</option>
              {periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title{' '}
            <input
              value={title}
              maxLength={200}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Instructions{' '}
            <textarea
              value={instructions}
              maxLength={10000}
              required
              onChange={(event) => setInstructions(event.target.value)}
            />
          </label>
          <label>
            Due date{' '}
            <input
              type="datetime-local"
              value={dueAt}
              required
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            Create draft
          </button>
        </form>
      )}
      <label>
        Assignment{' '}
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Choose an assignment</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {item.status}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <div>
          <h4>{current.title}</h4>
          <p>Status: {current.status}</p>
          <p>Due: {new Date(current.dueAt).toLocaleString()}</p>
          <p>{current.instructions}</p>
          {counts && (
            <p>
              Assigned {counts.assigned} · Submitted {counts.submitted} · Not
              submitted {counts.notSubmitted} · Late {counts.late}
            </p>
          )}
          {current.status === 'draft' && (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(
                    () =>
                      editTeacherCoursework(baseUrl, schoolId, current.id, {
                        title,
                        instructions,
                        dueAt: new Date(dueAt).toISOString(),
                      }),
                    'Draft updated.',
                  )
                }}
              >
                <label>
                  Draft title{' '}
                  <input
                    value={title}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label>
                  Draft instructions{' '}
                  <textarea
                    value={instructions}
                    required
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </label>
                <label>
                  Draft due date{' '}
                  <input
                    type="datetime-local"
                    value={dueAt}
                    required
                    onChange={(event) => setDueAt(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Save draft
                </button>
              </form>
              <label>
                Add attachment{' '}
                <input
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file)
                      void run(
                        () =>
                          uploadTeacherCoursework(
                            baseUrl,
                            schoolId,
                            current.id,
                            file,
                          ),
                        'Attachment queued for security scan.',
                      )
                  }}
                />
              </label>
            </>
          )}
          <ul>
            {detail.attachments.map((file) => (
              <li key={file.id}>
                {file.originalFileName} · {file.status}
              </li>
            ))}
          </ul>
          {current.status === 'draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    transitionTeacherCoursework(
                      baseUrl,
                      schoolId,
                      current.id,
                      'publish',
                    ),
                  'Assignment published.',
                )
              }
            >
              Publish
            </button>
          )}
          {current.status === 'published' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    transitionTeacherCoursework(
                      baseUrl,
                      schoolId,
                      current.id,
                      'close',
                    ),
                  'Assignment closed.',
                )
              }
            >
              Close
            </button>
          )}
          {(current.status === 'draft' || current.status === 'published') && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    transitionTeacherCoursework(
                      baseUrl,
                      schoolId,
                      current.id,
                      'cancel',
                    ),
                  'Assignment cancelled.',
                )
              }
            >
              Cancel
            </button>
          )}
          {current.status === 'published' && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void run(
                  () =>
                    grantTeacherCourseworkExtension(
                      baseUrl,
                      schoolId,
                      current.id,
                      extensionStudentId,
                      new Date(extensionDueAt).toISOString(),
                      extensionReason,
                    ),
                  'Student extension granted.',
                )
              }}
            >
              <h5>Grant student extension</h5>
              <label>
                Student{' '}
                <select
                  value={extensionStudentId}
                  required
                  onChange={(event) =>
                    setExtensionStudentId(event.target.value)
                  }
                >
                  <option value="">Choose student</option>
                  {audience.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.name} · {student.studentReference}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New due date{' '}
                <input
                  type="datetime-local"
                  value={extensionDueAt}
                  required
                  onChange={(event) => setExtensionDueAt(event.target.value)}
                />
              </label>
              <label>
                Reason{' '}
                <input
                  value={extensionReason}
                  required
                  maxLength={500}
                  onChange={(event) => setExtensionReason(event.target.value)}
                />
              </label>
              <button type="submit" disabled={busy}>
                Grant extension
              </button>
            </form>
          )}
          <TeacherSubmissionReview
            baseUrl={baseUrl}
            schoolId={schoolId}
            assignmentId={current.id}
            onSessionExpired={onSessionExpired}
          />
          <TeacherRubricPanel
            baseUrl={baseUrl}
            schoolId={schoolId}
            assignmentId={current.id}
            assignmentStatus={current.status}
            onSessionExpired={onSessionExpired}
          />
        </div>
      )}
    </section>
  )
}

function TeacherSubmissionReview({
  baseUrl,
  schoolId,
  assignmentId,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  assignmentId: string
  onSessionExpired: () => void
}) {
  const [submissions, setSubmissions] = useState<StaffCourseworkSubmission[]>(
    [],
  )
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<StaffCourseworkDetail | null>(null)
  const [returnDue, setReturnDue] = useState('')
  const [rubric, setRubric] = useState<CourseworkRubric | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({})
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getTeacherRubric(baseUrl, schoolId, assignmentId)
      .then((result) => {
        if (active) setRubric(result.rubric)
      })
      .catch(() => {
        if (active) setRubric(null)
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, assignmentId, refresh])
  useEffect(() => {
    let active = true
    listTeacherSubmissions(baseUrl, schoolId, assignmentId)
      .then((result) => {
        if (active) setSubmissions(result.submissions)
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401)
            onSessionExpired()
          else setError('Could not load submissions.')
        }
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, assignmentId, refresh, onSessionExpired])
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let active = true
    getTeacherSubmission(baseUrl, schoolId, assignmentId, selectedId)
      .then((result) => {
        if (active) {
          setDetail(result)
          setFeedbackText(
            Object.fromEntries(
              result.revisions.map((item) => [
                item.id,
                item.feedback?.text ?? '',
              ]),
            ),
          )
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401)
            onSessionExpired()
          else setError('Could not load submission history.')
        }
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, assignmentId, selectedId, refresh, onSessionExpired])
  async function review(revisionId: string, status: 'reviewed' | 'returned') {
    setError('')
    try {
      await reviewTeacherRevision(
        baseUrl,
        schoolId,
        assignmentId,
        revisionId,
        status === 'reviewed'
          ? { status }
          : { status, resubmissionDueAt: new Date(returnDue).toISOString() },
      )
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else setError(cause instanceof Error ? cause.message : 'Review failed.')
    }
  }
  async function score(revisionId: string) {
    if (!rubric) return
    setError('')
    try {
      await scoreTeacherRevision(
        baseUrl,
        schoolId,
        assignmentId,
        revisionId,
        rubric.criteria.map((criterion) => ({
          criterionId: criterion.id,
          points: scores[criterion.id] ?? '',
        })),
      )
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else setError(cause instanceof Error ? cause.message : 'Scoring failed.')
    }
  }
  async function feedback(revisionId: string, action: 'save' | 'release') {
    setError('')
    try {
      if (action === 'save')
        await saveTeacherFeedback(
          baseUrl,
          schoolId,
          assignmentId,
          revisionId,
          feedbackText[revisionId] ?? '',
        )
      else
        await releaseTeacherFeedback(
          baseUrl,
          schoolId,
          assignmentId,
          revisionId,
        )
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else
        setError(
          cause instanceof Error ? cause.message : 'Feedback action failed.',
        )
    }
  }
  return (
    <section aria-label="Submission review">
      <h5>Submission review</h5>
      {error && <p role="alert">{error}</p>}
      <label>
        Student submission{' '}
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Choose submission</option>
          {submissions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.student.givenName} {item.student.familyName ?? ''} ·{' '}
              {item.status}
            </option>
          ))}
        </select>
      </label>
      {detail?.revisions.map((item) => (
        <div key={item.id}>
          <p>
            Revision {item.revisionNumber} · Submitted{' '}
            {item.submittedAt
              ? new Date(item.submittedAt).toLocaleString()
              : ''}{' '}
            · Review {item.review?.status ?? 'pending'}
          </p>
          <p>{item.textResponse}</p>
          {item.rubricScores?.[0] && (
            <p>
              Coursework score: {item.rubricScores[0].totalPoints} · Version{' '}
              {item.rubricScores[0].version}. This is not an official mark.
            </p>
          )}
          {rubric && (
            <div>
              <p>
                Rubric: {rubric.title} · Maximum {rubric.totalPoints}
              </p>
              {rubric.criteria.map((criterion) => (
                <label key={criterion.id}>
                  {criterion.title} (0–{criterion.maxPoints}){' '}
                  <input
                    type="number"
                    min="0"
                    max={criterion.maxPoints}
                    step="0.01"
                    value={scores[criterion.id] ?? ''}
                    onChange={(event) =>
                      setScores((current) => ({
                        ...current,
                        [criterion.id]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                disabled={rubric.criteria.some(
                  (criterion) => !scores[criterion.id],
                )}
                onClick={() => void score(item.id)}
              >
                Save rubric score
              </button>
            </div>
          )}
          {item.review?.status === 'reviewed' && (
            <div>
              <p>Feedback: {item.feedback?.status ?? 'none'}</p>
              {item.feedback?.status !== 'released' && (
                <>
                  <label>
                    Plain-text feedback{' '}
                    <textarea
                      value={feedbackText[item.id] ?? ''}
                      onChange={(event) =>
                        setFeedbackText((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!feedbackText[item.id]?.trim()}
                    onClick={() => void feedback(item.id, 'save')}
                  >
                    Save feedback draft
                  </button>
                  {item.feedback?.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => void feedback(item.id, 'release')}
                    >
                      Release feedback
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {item.review?.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => void review(item.id, 'reviewed')}
              >
                Mark reviewed
              </button>
              <label>
                Resubmission deadline{' '}
                <input
                  type="datetime-local"
                  value={returnDue}
                  onChange={(event) => setReturnDue(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!returnDue}
                onClick={() => void review(item.id, 'returned')}
              >
                Return for resubmission
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  )
}

function TeacherRubricPanel({
  baseUrl,
  schoolId,
  assignmentId,
  assignmentStatus,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  assignmentId: string
  assignmentStatus: CourseworkAssignment['status']
  onSessionExpired: () => void
}) {
  const [rubric, setRubric] = useState<CourseworkRubric | null>(null)
  const [title, setTitle] = useState('')
  const [criteria, setCriteria] = useState([
    { title: '', description: '', maxPoints: '' },
  ])
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getTeacherRubric(baseUrl, schoolId, assignmentId)
      .then((result) => {
        if (!active) return
        setRubric(result.rubric)
        if (result.rubric) {
          setTitle(result.rubric.title)
          setCriteria(
            result.rubric.criteria.map((item) => ({
              title: item.title,
              description: item.description,
              maxPoints: item.maxPoints,
            })),
          )
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401)
            onSessionExpired()
          else setError('Could not load rubric.')
        }
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, assignmentId, refresh, onSessionExpired])
  async function save() {
    setError('')
    try {
      await saveTeacherRubric(
        baseUrl,
        schoolId,
        assignmentId,
        { title, criteria },
        Boolean(rubric),
      )
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else
        setError(
          cause instanceof Error ? cause.message : 'Could not save rubric.',
        )
    }
  }
  const editable =
    !rubric?.frozenAt &&
    (assignmentStatus === 'draft' || assignmentStatus === 'published')
  return (
    <section aria-label="Assignment rubric">
      <h5>Assignment rubric</h5>
      {error && <p role="alert">{error}</p>}
      {rubric && (
        <p>
          Maximum {rubric.totalPoints} points ·{' '}
          {rubric.frozenAt
            ? 'Frozen after scoring'
            : 'Editable until scoring begins'}
        </p>
      )}
      {editable && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label>
            Rubric title{' '}
            <input
              value={title}
              required
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {criteria.map((criterion, index) => (
            <fieldset key={index}>
              <legend>Criterion {index + 1}</legend>
              <label>
                Title{' '}
                <input
                  value={criterion.title}
                  required
                  maxLength={200}
                  onChange={(event) =>
                    setCriteria((rows) =>
                      rows.map((row, position) =>
                        position === index
                          ? { ...row, title: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Description{' '}
                <input
                  value={criterion.description}
                  required
                  maxLength={1000}
                  onChange={(event) =>
                    setCriteria((rows) =>
                      rows.map((row, position) =>
                        position === index
                          ? { ...row, description: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Maximum points{' '}
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={criterion.maxPoints}
                  required
                  onChange={(event) =>
                    setCriteria((rows) =>
                      rows.map((row, position) =>
                        position === index
                          ? { ...row, maxPoints: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </label>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={criteria.length >= 20}
            onClick={() =>
              setCriteria((rows) => [
                ...rows,
                { title: '', description: '', maxPoints: '' },
              ])
            }
          >
            Add criterion
          </button>
          <button type="submit">Save rubric</button>
        </form>
      )}
      {rubric?.frozenAt && (
        <ul>
          {rubric.criteria.map((criterion) => (
            <li key={criterion.id}>
              {criterion.title} · {criterion.maxPoints} points
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
