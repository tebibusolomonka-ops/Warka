import { useEffect, useState } from 'react'
import { ApiError } from './api'
import { FormErrorSummary } from './FormErrorSummary'
import {
  getOwnCourseworkSubmission,
  getStudentCoursework,
  listStudentCoursework,
  getStudentCourseworkSummary,
  type PersonalCourseworkSummary,
  saveStudentCourseworkDraft,
  startStudentCoursework,
  submitStudentCoursework,
  uploadStudentCoursework,
  withdrawStudentCoursework,
  type CourseworkAssignment,
  type CourseworkRevision,
  type CourseworkSubmission,
  type StudentCourseworkDetail,
} from './courseworkApi'

function stateLabel(
  detail: StudentCourseworkDetail,
  submission: CourseworkSubmission | null,
) {
  if (detail.assignment.status === 'closed' && detail.editableUntil)
    return 'Returned for resubmission'
  if (submission?.status === 'submitted' && submission.submittedAt)
    return new Date(submission.submittedAt) > new Date(detail.effectiveDueAt)
      ? 'Late'
      : 'Submitted'
  if (
    detail.assignment.status === 'closed' ||
    new Date(detail.effectiveDueAt) < new Date()
  )
    return 'Closed'
  if (!submission || submission.status === 'withdrawn') return 'Not started'
  return 'Draft'
}
const assignmentAttachmentUrl = (
  baseUrl: string,
  assignment: CourseworkAssignment,
  attachmentId: string,
) =>
  `${baseUrl}/schools/${encodeURIComponent(assignment.schoolId)}/coursework/${encodeURIComponent(assignment.id)}/attachments/${encodeURIComponent(attachmentId)}/download`
const submissionAttachmentUrl = (
  baseUrl: string,
  assignment: CourseworkAssignment,
  revisionId: string,
  attachmentId: string,
) =>
  `${baseUrl}/schools/${encodeURIComponent(assignment.schoolId)}/coursework/${encodeURIComponent(assignment.id)}/revisions/${encodeURIComponent(revisionId)}/attachments/${encodeURIComponent(attachmentId)}/download`

export function StudentCourseworkWorkspace({
  baseUrl,
  onSessionExpired,
}: {
  baseUrl: string
  onSessionExpired: () => void
}) {
  const [assignments, setAssignments] = useState<CourseworkAssignment[]>([])
  const [summary, setSummary] = useState<PersonalCourseworkSummary | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<StudentCourseworkDetail | null>(null)
  const [submission, setSubmission] = useState<CourseworkSubmission | null>(
    null,
  )
  const [revisions, setRevisions] = useState<CourseworkRevision[]>([])
  const [textResponse, setTextResponse] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    listStudentCoursework(baseUrl)
      .then((result) => {
        if (active) setAssignments(result.assignments)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setError('Could not load coursework.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSessionExpired])
  useEffect(() => {
    let active = true
    getStudentCourseworkSummary(baseUrl)
      .then((value) => {
        if (active) setSummary(value)
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSessionExpired])
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setSubmission(null)
      setRevisions([])
      return
    }
    let active = true
    Promise.all([
      getStudentCoursework(baseUrl, selectedId),
      getOwnCourseworkSubmission(baseUrl, selectedId),
    ])
      .then(([nextDetail, nextSubmission]) => {
        if (active) {
          setDetail(nextDetail)
          setSubmission(nextSubmission.submission)
          setRevisions(nextSubmission.revisions)
          setTextResponse(
            nextSubmission.revisions.find((item) => !item.submittedAt)
              ?.textResponse ?? '',
          )
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setError('Could not load this assignment.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, selectedId, refresh, onSessionExpired])
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
  const upcoming = assignments.filter(
    (item) =>
      item.status === 'published' &&
      new Date(item.effectiveDueAt ?? item.dueAt) >= new Date(),
  )
  const past = assignments.filter((item) => !upcoming.includes(item))
  const latestDraft = revisions.find((item) => !item.submittedAt)
  const canEdit = Boolean(
    detail?.editableUntil && new Date(detail.editableUntil) >= new Date(),
  )
  return (
    <section
      className="academic-panel"
      aria-labelledby="student-coursework-heading"
    >
      <h3 id="student-coursework-heading">Coursework</h3>
      {summary && (
        <p>
          Assigned {summary.assigned} · Submitted {summary.submitted} · Not
          submitted {summary.notSubmitted} · Late {summary.late} · Feedback
          available {summary.feedbackAvailable}
        </p>
      )}
      <FormErrorSummary id="coursework-error" message={error} />
      {message && <p role="status">{message}</p>}
      <h4>Upcoming assignments</h4>
      <ul>
        {upcoming.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => setSelectedId(item.id)}>
              {item.title}
            </button>{' '}
            · Due {new Date(item.effectiveDueAt ?? item.dueAt).toLocaleString()}
          </li>
        ))}
      </ul>
      <h4>Past assignments</h4>
      <ul>
        {past.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => setSelectedId(item.id)}>
              {item.title}
            </button>{' '}
            · {item.status === 'closed' ? 'Closed' : 'Past due'}
          </li>
        ))}
      </ul>
      {detail && (
        <div>
          <h4>{detail.assignment.title}</h4>
          <p>
            {detail.context.className} · {detail.context.subjectName} ·{' '}
            {detail.context.teacherName}
          </p>
          <p>
            Due {new Date(detail.effectiveDueAt).toLocaleString()}
            {detail.effectiveDueAt !== detail.assignment.dueAt
              ? ' · Personal extension'
              : ''}
          </p>
          <p>Status: {stateLabel(detail, submission)}</p>
          <p>{detail.assignment.instructions}</p>
          <h5>Assignment files</h5>
          <ul>
            {detail.attachments.map((file) => (
              <li key={file.id}>
                {file.status === 'available' ? (
                  <a
                    href={assignmentAttachmentUrl(
                      baseUrl,
                      detail.assignment,
                      file.id,
                    )}
                  >
                    {file.originalFileName}
                  </a>
                ) : (
                  file.originalFileName
                )}{' '}
                · {file.status}
              </li>
            ))}
          </ul>
          {canEdit && (!submission || submission.status === 'withdrawn') && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => startStudentCoursework(baseUrl, detail.assignment.id),
                  'Draft started.',
                )
              }
            >
              Start submission
            </button>
          )}
          {canEdit && submission && submission.status !== 'withdrawn' && (
            <>
              <label>
                Text response{' '}
                <textarea
                  aria-invalid={!!error}
                  aria-describedby={error ? 'coursework-error' : undefined}
                  value={textResponse}
                  maxLength={20000}
                  onChange={(event) => setTextResponse(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      saveStudentCourseworkDraft(
                        baseUrl,
                        detail.assignment.id,
                        textResponse,
                      ),
                    'Draft saved.',
                  )
                }
              >
                Save draft
              </button>
              {latestDraft && (
                <>
                  <label>
                    Attach response file{' '}
                    <input
                      type="file"
                      accept=".pdf,.txt,.png,.jpg,.jpeg"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file)
                          void run(
                            () =>
                              uploadStudentCoursework(
                                baseUrl,
                                detail.assignment.id,
                                latestDraft.id,
                                file,
                              ),
                            'File queued for security scan.',
                          )
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          submitStudentCoursework(
                            baseUrl,
                            detail.assignment.id,
                          ),
                        'Revision submitted.',
                      )
                    }
                  >
                    Submit revision
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      withdrawStudentCoursework(baseUrl, detail.assignment.id),
                    'Submission withdrawn; revision history retained.',
                  )
                }
              >
                Withdraw
              </button>
            </>
          )}
          <h5>Submission history</h5>
          <ul>
            {revisions.map((item) => (
              <li key={item.id}>
                Revision {item.revisionNumber} ·{' '}
                {item.submittedAt
                  ? `Submitted ${new Date(item.submittedAt).toLocaleString()}`
                  : 'Draft'}
                <p>{item.textResponse}</p>
                {item.feedback && <p>Teacher feedback: {item.feedback.text}</p>}
                {item.rubricScore && (
                  <div>
                    <p>
                      Released rubric result: {item.rubricScore.totalPoints}{' '}
                      points. This is not an official mark.
                    </p>
                    <ul>
                      {item.rubricScore.criteria.map((criterion) => (
                        <li key={criterion.title}>
                          {criterion.title}: {criterion.points} of{' '}
                          {criterion.maxPoints}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ul>
                  {item.attachments.map((file) => (
                    <li key={file.id}>
                      {file.fileAsset.status === 'available' ? (
                        <a
                          href={submissionAttachmentUrl(
                            baseUrl,
                            detail.assignment,
                            item.id,
                            file.id,
                          )}
                        >
                          {file.fileAsset.originalFileName}
                        </a>
                      ) : (
                        file.fileAsset.originalFileName
                      )}{' '}
                      · {file.fileAsset.status}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
