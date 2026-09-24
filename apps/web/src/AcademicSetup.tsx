import { useEffect, useState, type FormEvent } from 'react'
import {
  createAcademicAssessment,
  createAcademicPeriod,
  createAcademicSubject,
  createTeachingAssignment,
  getAcademicScheme,
  saveAcademicScheme,
  type AcademicStructure,
} from './academicApi'
import { ApiError } from './api'

export function AcademicSetup({
  baseUrl,
  schoolId,
  structure,
  onChanged,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  structure: AcademicStructure
  onChanged: () => void
  onSessionExpired: () => void
}) {
  const [subjectName, setSubjectName] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [yearId, setYearId] = useState('')
  const [periodName, setPeriodName] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [assessmentName, setAssessmentName] = useState('')
  const [maximumScore, setMaximumScore] = useState('')
  const [weight, setWeight] = useState('')
  const [position, setPosition] = useState('0')
  const [teacherId, setTeacherId] = useState('')
  const [bandsText, setBandsText] = useState('')
  const [schemeLoading, setSchemeLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setSchemeLoading(true)
    getAcademicScheme(baseUrl, schoolId)
      .then((scheme) => {
        if (active) {
          setBandsText(
            scheme?.bands
              .map((band) => band.minimumPercentage + ',' + band.label)
              .join('\n') ?? '',
          )
          setSchemeLoading(false)
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        setSchemeLoading(false)
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setError('Could not load grading bands.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, onSessionExpired])

  const selectedYear = yearId || structure.academicYears[0]?.id || ''
  const classes = structure.classes.filter(
    (item) => item.academicYearId === selectedYear,
  )
  const periods = structure.gradingPeriods.filter(
    (item) => item.academicYearId === selectedYear,
  )
  const selectedClass = classId || classes[0]?.id || ''
  const selectedSubject = subjectId || structure.subjects[0]?.id || ''
  const selectedPeriod = periodId || periods[0]?.id || ''
  const selectedTeacher = teacherId || structure.teachers[0]?.id || ''

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      onChanged()
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

  function createSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      await createAcademicSubject(
        baseUrl,
        schoolId,
        subjectName.trim(),
        subjectCode.trim() || undefined,
      )
      setSubjectName('')
      setSubjectCode('')
    }, 'Subject saved.')
  }

  function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedYear) return
    void run(async () => {
      await createAcademicPeriod(
        baseUrl,
        schoolId,
        selectedYear,
        periodName.trim(),
        startsOn,
        endsOn,
      )
      setPeriodName('')
    }, 'Grading period saved.')
  }

  function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedYear || !selectedPeriod || !selectedClass || !selectedSubject)
      return
    void run(async () => {
      await createAcademicAssessment(
        baseUrl,
        schoolId,
        {
          academicYearId: selectedYear,
          gradingPeriodId: selectedPeriod,
          schoolClassId: selectedClass,
          subjectId: selectedSubject,
        },
        assessmentName.trim(),
        maximumScore,
        weight,
        Number(position),
      )
      setAssessmentName('')
      setMaximumScore('')
      setWeight('')
    }, 'Assessment saved.')
  }

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTeacher || !selectedYear || !selectedClass || !selectedSubject)
      return
    void run(
      () =>
        createTeachingAssignment(
          baseUrl,
          schoolId,
          selectedTeacher,
          selectedYear,
          selectedClass,
          selectedSubject,
        ),
      'Teacher assigned.',
    )
  }

  function saveScheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const lines = bandsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const bands = lines.map((line) => {
      const separator = line.indexOf(',')
      return {
        minimumPercentage: line.slice(0, separator).trim(),
        label: line.slice(separator + 1).trim(),
      }
    })
    if (
      !bands.length ||
      bands.some(
        (band) =>
          !band.label || !/^\d{1,3}(\.\d{1,2})?$/.test(band.minimumPercentage),
      )
    ) {
      setError('Enter one percentage and label per line, separated by a comma.')
      return
    }
    void run(
      () => saveAcademicScheme(baseUrl, schoolId, bands),
      'Grading bands saved.',
    )
  }

  return (
    <section
      aria-labelledby="academic-setup-heading"
      className="academic-panel"
    >
      <h3 id="academic-setup-heading">Academic setup</h3>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form onSubmit={createSubject}>
        <h4>Subjects</h4>
        <div className="academic-fields">
          <label>
            Subject name
            <input
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label>
            Code (optional)
            <input
              value={subjectCode}
              onChange={(event) => setSubjectCode(event.target.value)}
              maxLength={40}
            />
          </label>
          <button disabled={busy}>Add subject</button>
        </div>
      </form>
      {structure.academicYears.length === 0 ? (
        <p>Create an academic year before adding grading periods.</p>
      ) : (
        <>
          <div className="academic-fields">
            <label>
              Academic year
              <select
                value={selectedYear}
                onChange={(event) => {
                  setYearId(event.target.value)
                  setClassId('')
                  setPeriodId('')
                }}
              >
                {structure.academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Class
              <select
                value={selectedClass}
                onChange={(event) => setClassId(event.target.value)}
                disabled={!classes.length}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.gradeLevelName} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <select
                value={selectedSubject}
                onChange={(event) => setSubjectId(event.target.value)}
                disabled={!structure.subjects.length}
              >
                {structure.subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <form onSubmit={createPeriod}>
            <h4>Grading periods</h4>
            <div className="academic-fields">
              <label>
                Period name
                <input
                  value={periodName}
                  onChange={(event) => setPeriodName(event.target.value)}
                  required
                  maxLength={200}
                />
              </label>
              <label>
                Starts on
                <input
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                  required
                />
              </label>
              <label>
                Ends on
                <input
                  type="date"
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  required
                />
              </label>
              <button disabled={busy}>Add period</button>
            </div>
          </form>
          {periods.length === 0 ? (
            <p>No academic periods for this year yet.</p>
          ) : (
            <form onSubmit={createAssessment}>
              <h4>Assessments</h4>
              <div className="academic-fields">
                <label>
                  Grading period
                  <select
                    value={selectedPeriod}
                    onChange={(event) => setPeriodId(event.target.value)}
                  >
                    {periods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assessment name
                  <input
                    value={assessmentName}
                    onChange={(event) => setAssessmentName(event.target.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  Maximum score
                  <input
                    value={maximumScore}
                    onChange={(event) => setMaximumScore(event.target.value)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  Weight %
                  <input
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  Position
                  <input
                    value={position}
                    onChange={(event) => setPosition(event.target.value)}
                    type="number"
                    min="0"
                    max="1000"
                    required
                  />
                </label>
                <button disabled={busy || !selectedClass || !selectedSubject}>
                  Add assessment
                </button>
              </div>
            </form>
          )}
          {structure.teachers.length > 0 &&
            classes.length > 0 &&
            structure.subjects.length > 0 && (
              <form onSubmit={assign}>
                <h4>Teaching assignments</h4>
                <div className="academic-fields">
                  <label>
                    Teacher
                    <select
                      value={selectedTeacher}
                      onChange={(event) => setTeacherId(event.target.value)}
                    >
                      {structure.teachers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy}>
                    Assign teacher to selected class and subject
                  </button>
                </div>
              </form>
            )}
        </>
      )}
      <form onSubmit={saveScheme}>
        <h4>Grading bands</h4>
        {schemeLoading ? (
          <p role="status">Loading grading bands</p>
        ) : (
          <>
            <label>
              One minimum percentage and label per line
              <textarea
                value={bandsText}
                onChange={(event) => setBandsText(event.target.value)}
                rows={4}
                aria-label="Grading bands"
              />
            </label>
            <p>
              Include a band starting at 0. The school chooses the labels and
              thresholds.
            </p>
            <button disabled={busy}>Save grading bands</button>
          </>
        )}
      </form>
    </section>
  )
}
