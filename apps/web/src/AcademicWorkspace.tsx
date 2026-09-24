import { useEffect, useState } from 'react'
import {
  applyAcademicImport,
  correctAcademicResult,
  getAcademicPreview,
  getAcademicStructure,
  getResultSets,
  getTeachingAssignments,
  publishAcademicResults,
  saveAcademicMark,
  submitAcademicResults,
  validateAcademicImport,
  type AcademicContext,
  type AcademicPreview,
  type AcademicStructure,
  type ImportReview,
  type ResultSetSummary,
  type TeachingAssignment,
} from './academicApi'
import { ApiError } from './api'
import { AcademicSetup } from './AcademicSetup'

type WorkspaceData = {
  structure: AcademicStructure
  assignments: TeachingAssignment[]
  pending: ResultSetSummary[]
  published: ResultSetSummary[]
}
type LoadState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: T }

function unique(values: string[]) {
  return [...new Set(values)]
}

function scoreKey(enrollmentId: string, assessmentId: string) {
  return enrollmentId + ':' + assessmentId
}

function resultName(item: ResultSetSummary, structure: AcademicStructure) {
  const schoolClass = structure.classes.find(
    (entry) => entry.id === item.schoolClassId,
  )
  const subject = structure.subjects.find(
    (entry) => entry.id === item.subjectId,
  )
  const period = structure.gradingPeriods.find(
    (entry) => entry.id === item.gradingPeriodId,
  )
  return (
    (schoolClass
      ? schoolClass.gradeLevelName + ' ' + schoolClass.name
      : 'Class') +
    ' · ' +
    (subject?.name ?? 'Subject') +
    ' · ' +
    (period?.name ?? 'Period')
  )
}

export function AcademicWorkspace({
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
  const [load, setLoad] = useState<LoadState<WorkspaceData>>({
    status: 'loading',
  })
  const [refresh, setRefresh] = useState(0)
  const [previewRefresh, setPreviewRefresh] = useState(0)
  const [yearId, setYearId] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [reviewSet, setReviewSet] = useState<ResultSetSummary | null>(null)
  const [preview, setPreview] = useState<LoadState<AcademicPreview>>({
    status: 'loading',
  })
  const [scores, setScores] = useState<Record<string, string>>({})
  const [cellMessages, setCellMessages] = useState<Record<string, string>>({})
  const [csv, setCsv] = useState('')
  const [importAssessmentId, setImportAssessmentId] = useState('')
  const [importReview, setImportReview] = useState<ImportReview | null>(null)
  const [importOutcome, setImportOutcome] = useState('')
  const [correctionId, setCorrectionId] = useState('')
  const [correctedPercentage, setCorrectedPercentage] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    getAcademicStructure(baseUrl, schoolId)
      .then(async (structure) => {
        const [assignments, pending, published] = await Promise.all([
          getTeachingAssignments(baseUrl, schoolId),
          structure.role === 'approver' || structure.role === 'administrator'
            ? getResultSets(baseUrl, schoolId, 'pending')
            : Promise.resolve([]),
          structure.role === 'approver' || structure.role === 'administrator'
            ? getResultSets(baseUrl, schoolId, 'published')
            : Promise.resolve([]),
        ])
        if (active)
          setLoad({
            status: 'loaded',
            data: { structure, assignments, pending, published },
          })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setLoad({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, refresh, onSessionExpired])

  const data = load.status === 'loaded' ? load.data : null
  const assignmentYears = data
    ? unique(data.assignments.map((item) => item.academicYearId))
    : []
  const selectedYear = yearId || assignmentYears[0] || ''
  const classAssignments =
    data?.assignments.filter((item) => item.academicYearId === selectedYear) ??
    []
  const availableClassIds = unique(
    classAssignments.map((item) => item.schoolClassId),
  )
  const selectedClass = classId || availableClassIds[0] || ''
  const subjectAssignments = classAssignments.filter(
    (item) => item.schoolClassId === selectedClass,
  )
  const availableSubjectIds = unique(
    subjectAssignments.map((item) => item.subjectId),
  )
  const selectedSubject = subjectId || availableSubjectIds[0] || ''
  const periods =
    data?.structure.gradingPeriods.filter(
      (item) => item.academicYearId === selectedYear,
    ) ?? []
  const selectedPeriod = periodId || periods[0]?.id || ''
  const assignmentContext: AcademicContext | null =
    selectedYear && selectedClass && selectedSubject && selectedPeriod
      ? {
          academicYearId: selectedYear,
          schoolClassId: selectedClass,
          subjectId: selectedSubject,
          gradingPeriodId: selectedPeriod,
        }
      : null
  const context: AcademicContext | null = reviewSet
    ? {
        academicYearId: reviewSet.academicYearId,
        gradingPeriodId: reviewSet.gradingPeriodId,
        schoolClassId: reviewSet.schoolClassId,
        subjectId: reviewSet.subjectId,
      }
    : assignmentContext

  useEffect(() => {
    if (!context) return
    let active = true
    setPreview({ status: 'loading' })
    getAcademicPreview(baseUrl, schoolId, context)
      .then((result) => {
        if (!active) return
        setPreview({ status: 'loaded', data: result })
        setScores(
          Object.fromEntries(
            result.rows.flatMap((row) =>
              row.marks.map((mark) => [
                scoreKey(row.enrollmentId, mark.assessmentId),
                mark.score,
              ]),
            ),
          ),
        )
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setPreview({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [
    baseUrl,
    schoolId,
    context?.academicYearId,
    context?.gradingPeriodId,
    context?.schoolClassId,
    context?.subjectId,
    previewRefresh,
    refresh,
    onSessionExpired,
  ])

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setPreviewRefresh((value) => value + 1)
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Request failed. Try again.',
        )
    } finally {
      setBusy(false)
    }
  }

  async function saveScore(
    row: AcademicPreview['rows'][number],
    assessment: AcademicPreview['assessments'][number],
  ) {
    const key = scoreKey(row.enrollmentId, assessment.id)
    const value = (scores[key] ?? '').trim()
    if (
      !/^\d{1,6}(\.\d{1,2})?$/.test(value) ||
      Number(value) > Number(assessment.maximumScore)
    ) {
      setCellMessages((current) => ({ ...current, [key]: 'Invalid score' }))
      return
    }
    const existing = row.marks.find(
      (mark) => mark.assessmentId === assessment.id,
    )
    setBusy(true)
    setCellMessages((current) => ({ ...current, [key]: 'Saving' }))
    try {
      await saveAcademicMark(
        baseUrl,
        schoolId,
        row.enrollmentId,
        assessment.id,
        value,
        existing?.id,
      )
      setCellMessages((current) => ({ ...current, [key]: 'Saved' }))
      setPreviewRefresh((current) => current + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else
        setCellMessages((current) => ({
          ...current,
          [key]:
            cause instanceof ApiError ? cause.message : 'Could not save mark',
        }))
    } finally {
      setBusy(false)
    }
  }

  async function readCsv(file: File | undefined) {
    setImportReview(null)
    setImportOutcome('')
    setCsv('')
    setError('')
    if (!file) return
    if (file.size > 1_000_000) {
      setError('CSV file must be 1 MB or smaller.')
      return
    }
    try {
      setCsv(await file.text())
    } catch {
      setError('Could not read the CSV file.')
    }
  }

  const loadedPreview = preview.status === 'loaded' ? preview.data : null
  const selectedAssessment =
    importAssessmentId || loadedPreview?.assessments[0]?.id || ''
  const role = data?.structure.role
  const canEditMarks =
    (role === 'teacher' || role === 'administrator') &&
    loadedPreview?.status === 'draft' &&
    !reviewSet
  const canReview = role === 'approver' || role === 'administrator'

  return (
    <section
      aria-labelledby="academic-workspace-heading"
      className="academic-workspace"
    >
      <h2 id="academic-workspace-heading">Academic results · {schoolName}</h2>
      {load.status === 'loading' && (
        <p role="status">Loading academic workspace</p>
      )}
      {load.status === 'error' && (
        <div role="alert">
          <p>Could not load academic workspace.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry academic workspace
          </button>
        </div>
      )}
      {data && (
        <>
          {role === 'administrator' && (
            <AcademicSetup
              baseUrl={baseUrl}
              schoolId={schoolId}
              structure={data.structure}
              onChanged={() => setRefresh((value) => value + 1)}
              onSessionExpired={onSessionExpired}
            />
          )}
          {(role === 'teacher' || role === 'administrator') && (
            <section
              className="academic-panel"
              aria-labelledby="assignments-heading"
            >
              <h3 id="assignments-heading">Teaching assignments</h3>
              {data.assignments.length === 0 ? (
                <p>No teaching assignments are available for this account.</p>
              ) : (
                <>
                  <div className="academic-fields">
                    <label>
                      Result academic year
                      <select
                        value={selectedYear}
                        onChange={(event) => {
                          setYearId(event.target.value)
                          setClassId('')
                          setSubjectId('')
                          setPeriodId('')
                          setReviewSet(null)
                        }}
                      >
                        {assignmentYears.map((id) => (
                          <option key={id} value={id}>
                            {data.structure.academicYears.find(
                              (item) => item.id === id,
                            )?.name ?? 'Academic year'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Result class
                      <select
                        value={selectedClass}
                        onChange={(event) => {
                          setClassId(event.target.value)
                          setSubjectId('')
                          setReviewSet(null)
                        }}
                      >
                        {availableClassIds.map((id) => {
                          const item = data.structure.classes.find(
                            (entry) => entry.id === id,
                          )
                          return (
                            <option key={id} value={id}>
                              {item
                                ? item.gradeLevelName + ' · ' + item.name
                                : 'Class'}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <label>
                      Result subject
                      <select
                        value={selectedSubject}
                        onChange={(event) => {
                          setSubjectId(event.target.value)
                          setReviewSet(null)
                        }}
                      >
                        {availableSubjectIds.map((id) => (
                          <option key={id} value={id}>
                            {data.structure.subjects.find(
                              (item) => item.id === id,
                            )?.name ?? 'Subject'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Grading period
                      <select
                        value={selectedPeriod}
                        onChange={(event) => {
                          setPeriodId(event.target.value)
                          setReviewSet(null)
                        }}
                        disabled={!periods.length}
                      >
                        {periods.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {periods.length === 0 && (
                    <p>No academic periods for this assignment year.</p>
                  )}
                </>
              )}
            </section>
          )}
          {canReview && (
            <section
              className="academic-panel"
              aria-labelledby="review-heading"
            >
              <h3 id="review-heading">Result review</h3>
              <h4>Pending publication</h4>
              {data.pending.length === 0 && <p>No pending result sets.</p>}
              <ul>
                {data.pending.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setReviewSet(item)}>
                      Review {resultName(item, data.structure)}
                    </button>{' '}
                    submitted by{' '}
                    {item.submittedBy?.displayName ?? 'School staff'}
                  </li>
                ))}
              </ul>
              <h4>Published results</h4>
              {data.published.length === 0 && <p>No published result sets.</p>}
              <ul>
                {data.published.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setReviewSet(item)}>
                      Open {resultName(item, data.structure)}
                    </button>
                  </li>
                ))}
              </ul>
              {reviewSet && (
                <p>
                  Reviewing {resultName(reviewSet, data.structure)}.{' '}
                  <button type="button" onClick={() => setReviewSet(null)}>
                    Close review
                  </button>
                </p>
              )}
            </section>
          )}
          {context && (
            <section className="academic-panel" aria-labelledby="marks-heading">
              <h3 id="marks-heading">
                {reviewSet ? 'Result set' : 'Marks and results'}
              </h3>
              {preview.status === 'loading' && (
                <p role="status">Loading result preview</p>
              )}
              {preview.status === 'error' && (
                <div role="alert">
                  <p>Could not load results.</p>
                  <button
                    type="button"
                    onClick={() => setPreviewRefresh((value) => value + 1)}
                  >
                    Retry results
                  </button>
                </div>
              )}
              {loadedPreview && (
                <>
                  <p>
                    Result status: <strong>{loadedPreview.status}</strong>
                  </p>
                  {loadedPreview.assessments.length === 0 && (
                    <p>
                      No assessments have been configured for this class,
                      subject and period.
                    </p>
                  )}
                  {loadedPreview.rows.length === 0 && (
                    <p>No approved students are enrolled in this class.</p>
                  )}
                  {loadedPreview.assessments.length > 0 &&
                    loadedPreview.rows.length > 0 && (
                      <div className="academic-table-wrap">
                        <table>
                          <caption>
                            Student marks and calculated outcomes
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Student</th>
                              {loadedPreview.assessments.map((assessment) => (
                                <th scope="col" key={assessment.id}>
                                  {assessment.name}
                                  <br />
                                  <small>
                                    / {assessment.maximumScore} ·{' '}
                                    {assessment.weight}%
                                  </small>
                                </th>
                              ))}
                              <th scope="col">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadedPreview.rows.map((row) => (
                              <tr key={row.enrollmentId}>
                                <th scope="row">
                                  {row.givenName} {row.familyName ?? ''}
                                  <br />
                                  <small>{row.studentReference}</small>
                                </th>
                                {loadedPreview.assessments.map((assessment) => {
                                  const key = scoreKey(
                                    row.enrollmentId,
                                    assessment.id,
                                  )
                                  const savedMark = row.marks.find(
                                    (mark) =>
                                      mark.assessmentId === assessment.id,
                                  )
                                  return (
                                    <td key={assessment.id}>
                                      {canEditMarks ? (
                                        <div className="mark-cell">
                                          <input
                                            aria-label={
                                              assessment.name +
                                              ' score for ' +
                                              row.studentReference
                                            }
                                            inputMode="decimal"
                                            value={
                                              scores[key] ??
                                              savedMark?.score ??
                                              ''
                                            }
                                            onChange={(event) => {
                                              setScores((current) => ({
                                                ...current,
                                                [key]: event.target.value,
                                              }))
                                              setCellMessages((current) => ({
                                                ...current,
                                                [key]: '',
                                              }))
                                            }}
                                          />
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              void saveScore(row, assessment)
                                            }
                                          >
                                            Save
                                          </button>
                                          {cellMessages[key] && (
                                            <small role="status">
                                              {cellMessages[key]}
                                            </small>
                                          )}
                                        </div>
                                      ) : (
                                        (savedMark?.score ?? 'Missing')
                                      )}
                                    </td>
                                  )
                                })}
                                <td>
                                  {row.published ? (
                                    <>
                                      {row.published.currentPercentage}% ·{' '}
                                      {row.published.currentGradeLabel}
                                    </>
                                  ) : row.calculation.status === 'ready' ? (
                                    <>
                                      {row.calculation.percentage}% ·{' '}
                                      {row.calculation.gradeLabel}{' '}
                                      <small>Preview only</small>
                                    </>
                                  ) : row.calculation.status ===
                                    'missing_marks' ? (
                                    <span>
                                      Missing{' '}
                                      {
                                        row.calculation.missingAssessmentIds
                                          .length
                                      }{' '}
                                      mark(s)
                                    </span>
                                  ) : (
                                    <span>
                                      Configuration incomplete:{' '}
                                      {row.calculation.configurationProblems.join(
                                        ', ',
                                      )}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  {canEditMarks && loadedPreview.assessments.length > 0 && (
                    <div className="academic-import">
                      <h4>Import marks from CSV</h4>
                      <p>
                        CSV columns: studentReference,score. Review the file
                        before applying it.
                      </p>
                      <label>
                        Assessment for import
                        <select
                          value={selectedAssessment}
                          onChange={(event) => {
                            setImportAssessmentId(event.target.value)
                            setImportReview(null)
                          }}
                        >
                          {loadedPreview.assessments.map((assessment) => (
                            <option key={assessment.id} value={assessment.id}>
                              {assessment.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        CSV file
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(event) =>
                            void readCsv(event.target.files?.[0])
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!csv || busy}
                        onClick={() =>
                          void run(async () => {
                            setImportReview(
                              await validateAcademicImport(
                                baseUrl,
                                schoolId,
                                selectedAssessment,
                                csv,
                              ),
                            )
                          }, 'Import review ready.')
                        }
                      >
                        Validate import
                      </button>
                      {importReview && (
                        <div>
                          <p>
                            {importReview.valid
                              ? importReview.rows.length +
                                ' rows ready to apply.'
                              : importReview.problems.length +
                                ' import problems found.'}
                          </p>
                          {importReview.problems.length > 0 && (
                            <ul>
                              {importReview.problems.map((problem, index) => (
                                <li key={index}>
                                  Line {problem.line}: {problem.code}
                                  {problem.studentReference
                                    ? ' · ' + problem.studentReference
                                    : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                          {importReview.valid && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  const outcome = await applyAcademicImport(
                                    baseUrl,
                                    schoolId,
                                    selectedAssessment,
                                    csv,
                                  )
                                  setImportReview(null)
                                  setImportOutcome(
                                    outcome.created +
                                      ' created, ' +
                                      outcome.updated +
                                      ' updated.',
                                  )
                                }, 'Import applied.')
                              }
                            >
                              Apply reviewed import
                            </button>
                          )}
                        </div>
                      )}
                      {importOutcome && <p role="status">{importOutcome}</p>}
                    </div>
                  )}
                  {loadedPreview.status === 'draft' &&
                    loadedPreview.complete &&
                    role === 'teacher' &&
                    !reviewSet && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              submitAcademicResults(baseUrl, schoolId, context),
                            'Results submitted for review.',
                          )
                        }
                      >
                        Submit results for review
                      </button>
                    )}
                  {loadedPreview.status === 'draft' &&
                    !loadedPreview.complete && (
                      <p>
                        Complete assessment weights, grading bands and marks
                        before submission.
                      </p>
                    )}
                  {reviewSet &&
                    loadedPreview.status === 'pending' &&
                    canReview && (
                      <button
                        type="button"
                        disabled={busy || !loadedPreview.complete}
                        onClick={() =>
                          void run(
                            () =>
                              publishAcademicResults(
                                baseUrl,
                                schoolId,
                                reviewSet.id,
                              ),
                            'Results published.',
                          )
                        }
                      >
                        Publish results
                      </button>
                    )}
                  {reviewSet &&
                    loadedPreview.status === 'published' &&
                    canReview && (
                      <div className="academic-corrections">
                        <h4>Published result corrections</h4>
                        {loadedPreview.rows.map(
                          (row) =>
                            row.published && (
                              <div key={row.published.id}>
                                <p>
                                  {row.givenName} {row.familyName ?? ''} ·{' '}
                                  {row.studentReference} ·{' '}
                                  {row.published.currentPercentage}%{' '}
                                  {row.published.currentGradeLabel}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCorrectionId(row.published!.id)
                                    setCorrectedPercentage(
                                      row.published!.currentPercentage,
                                    )
                                    setCorrectionReason('')
                                  }}
                                >
                                  Correct result for {row.studentReference}
                                </button>
                              </div>
                            ),
                        )}
                        {correctionId && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault()
                              void run(async () => {
                                await correctAcademicResult(
                                  baseUrl,
                                  schoolId,
                                  correctionId,
                                  correctedPercentage,
                                  correctionReason,
                                )
                                setCorrectionId('')
                              }, 'Correction recorded.')
                            }}
                          >
                            <label>
                              Corrected percentage
                              <input
                                value={correctedPercentage}
                                onChange={(event) =>
                                  setCorrectedPercentage(event.target.value)
                                }
                                inputMode="decimal"
                                required
                              />
                            </label>
                            <label>
                              Reason
                              <textarea
                                value={correctionReason}
                                onChange={(event) =>
                                  setCorrectionReason(event.target.value)
                                }
                                minLength={5}
                                maxLength={500}
                                required
                              />
                            </label>
                            <button disabled={busy}>Record correction</button>
                          </form>
                        )}
                      </div>
                    )}
                </>
              )}
            </section>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
