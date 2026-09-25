import { useEffect, useState, type FormEvent } from 'react'
import {
  RegisterStudentSchema,
  type AccessibleSchool,
  type RegistrationResponse,
  type StudentDetailResponse,
  type StudentListResponse,
  type StudentOptions,
} from '@warka/shared'
import { StudentAccountPanel } from './StudentAccountPanel'
import { DocumentPanel } from './DocumentPanel'
import {
  actOnEnrollment,
  ApiError,
  getStudentDetail,
  getStudentOptions,
  getStudents,
  registerStudent,
} from './api'

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentListResponse }

type DetailState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentDetailResponse }

type OptionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentOptions }

function studentName(student: {
  givenName: string
  familyName: string | null
}) {
  return [student.givenName, student.familyName].filter(Boolean).join(' ')
}

export function StudentWorkspace({
  baseUrl,
  access,
  onSessionExpired,
}: {
  baseUrl: string
  access: AccessibleSchool
  onSessionExpired: () => void
}) {
  const schoolId = access.school.id
  const [view, setView] = useState<'list' | 'register' | 'detail'>('list')
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' })
  const [options, setOptions] = useState<OptionsState>({ status: 'loading' })
  const [optionsRefresh, setOptionsRefresh] = useState(0)
  const [registration, setRegistration] = useState<RegistrationResponse | null>(
    null,
  )
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [schoolClassId, setSchoolClassId] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  function handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      onSessionExpired()
    }
  }

  useEffect(() => {
    let active = true
    setList({ status: 'loading' })
    getStudents(baseUrl, schoolId, offset)
      .then((data) => {
        if (active) setList({ status: 'loaded', data })
      })
      .catch((error: unknown) => {
        if (!active) return
        handleError(error)
        setList({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, offset, refresh])

  useEffect(() => {
    if (view !== 'register' || !access.capabilities.canRegister) return
    let active = true
    setOptions({ status: 'loading' })
    getStudentOptions(baseUrl, schoolId)
      .then((data) => {
        if (!active) return
        setOptions({ status: 'loaded', data })
        setAcademicYearId(data.academicYears[0]?.id ?? '')
        setGradeLevelId(data.gradeLevels[0]?.id ?? '')
      })
      .catch((error: unknown) => {
        if (!active) return
        handleError(error)
        setOptions({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, view, access.capabilities.canRegister, optionsRefresh])

  async function openDetail(studentId: string) {
    setRegistration(null)
    setActionError('')
    setView('detail')
    setDetail({ status: 'loading' })
    try {
      setDetail({
        status: 'loaded',
        data: await getStudentDetail(baseUrl, schoolId, studentId),
      })
    } catch (error) {
      handleError(error)
      setDetail({ status: 'error' })
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!access.capabilities.canRegister) return
    const guardians =
      guardianName.trim() ||
      guardianRelationship.trim() ||
      guardianPhone.trim() ||
      guardianEmail.trim()
        ? [
            {
              name: guardianName,
              relationship: guardianRelationship,
              ...(guardianPhone.trim() ? { phone: guardianPhone } : {}),
              ...(guardianEmail.trim() ? { email: guardianEmail } : {}),
            },
          ]
        : []
    const parsed = RegisterStudentSchema.safeParse({
      student: {
        givenName,
        ...(familyName.trim() ? { familyName } : {}),
        ...(dateOfBirth ? { dateOfBirth } : {}),
      },
      academicYearId,
      gradeLevelId,
      ...(schoolClassId ? { schoolClassId } : {}),
      guardians,
    })
    if (!parsed.success) {
      setFormError('Check the student, academic, and guardian fields.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const result = await registerStudent(baseUrl, schoolId, parsed.data)
      setRegistration(result)
      setGivenName('')
      setFamilyName('')
      setDateOfBirth('')
      setSchoolClassId('')
      setGuardianName('')
      setGuardianRelationship('')
      setGuardianPhone('')
      setGuardianEmail('')
      setDetail({
        status: 'loaded',
        data: {
          student: result.student,
          enrollments: [result.enrollment],
          guardians: result.guardians,
        },
      })
      setView('detail')
      setRefresh((value) => value + 1)
    } catch (error) {
      handleError(error)
      setFormError(
        error instanceof ApiError &&
          error.code === 'INVALID_ENROLLMENT_STRUCTURE'
          ? 'Choose an academic year, grade, and class from this school.'
          : 'Could not register the student. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function enrollmentAction(
    enrollmentId: string,
    action: 'submit' | 'approve',
  ) {
    setBusy(true)
    setActionError('')
    try {
      const updated = await actOnEnrollment(
        baseUrl,
        schoolId,
        enrollmentId,
        action,
      )
      setDetail((current) =>
        current.status === 'loaded'
          ? {
              status: 'loaded',
              data: {
                ...current.data,
                enrollments: current.data.enrollments.map((enrollment) =>
                  enrollment.id === updated.id ? updated : enrollment,
                ),
              },
            }
          : current,
      )
      setRefresh((value) => value + 1)
    } catch (error) {
      handleError(error)
      setActionError('Could not update the enrollment. Refresh and try again.')
    } finally {
      setBusy(false)
    }
  }

  const classes =
    options.status === 'loaded'
      ? options.data.classes.filter(
          (item) =>
            item.academicYearId === academicYearId &&
            item.gradeLevelId === gradeLevelId,
        )
      : []
  const filtered =
    list.status === 'loaded'
      ? list.data.items.filter(({ student }) =>
          (studentName(student) + ' ' + student.studentReference)
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
        )
      : []

  return (
    <section aria-labelledby="students-heading">
      <h2 id="students-heading">Students · {access.school.name}</h2>
      <nav className="workspace-nav" aria-label="Student workspace">
        <button type="button" onClick={() => setView('list')}>
          Students
        </button>
        {access.capabilities.canRegister && (
          <button type="button" onClick={() => setView('register')}>
            Register student
          </button>
        )}
      </nav>

      {view === 'list' && (
        <>
          <div className="field">
            <label htmlFor="student-search">Search loaded students</label>
            <input
              id="student-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {list.status === 'loading' && <p role="status">Loading students</p>}
          {list.status === 'error' && (
            <div role="alert">
              <p>Could not load students.</p>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {list.status === 'loaded' && (
            <>
              {list.data.items.length === 0 && (
                <p>No students registered yet.</p>
              )}
              {list.data.items.length > 0 && filtered.length === 0 && (
                <p>No students match this search on the current page.</p>
              )}
              {filtered.length > 0 && (
                <ul className="student-list">
                  {filtered.map(({ student, enrollment }) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => void openDetail(student.id)}
                      >
                        {studentName(student)} · {student.studentReference}
                      </button>
                      <span className={'status status-' + enrollment.status}>
                        {enrollment.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="workspace-nav">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </button>
                <span>Page {Math.floor(offset / 50) + 1}</span>
                <button
                  type="button"
                  disabled={list.data.items.length < 50}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}

      {view === 'register' && access.capabilities.canRegister && (
        <>
          <h3>New student</h3>
          {options.status === 'loading' && (
            <p role="status">Loading academic choices</p>
          )}
          {options.status === 'error' && (
            <div role="alert">
              <p>Could not load academic choices.</p>
              <button
                type="button"
                onClick={() => setOptionsRefresh((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {options.status === 'loaded' &&
            (options.data.academicYears.length === 0 ||
              options.data.gradeLevels.length === 0) && (
              <p>
                This school needs an academic year and grade level before
                students can be registered.
              </p>
            )}
          {options.status === 'loaded' &&
            options.data.academicYears.length > 0 &&
            options.data.gradeLevels.length > 0 && (
              <form
                className="registration-form"
                aria-label="Student registration"
                onSubmit={(event) => void submitRegistration(event)}
              >
                <div className="field">
                  <label htmlFor="given-name">Given name</label>
                  <input
                    id="given-name"
                    value={givenName}
                    onChange={(event) => setGivenName(event.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="field">
                  <label htmlFor="family-name">Family name (optional)</label>
                  <input
                    id="family-name"
                    value={familyName}
                    onChange={(event) => setFamilyName(event.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="field">
                  <label htmlFor="date-of-birth">
                    Date of birth (optional)
                  </label>
                  <input
                    id="date-of-birth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="academic-year">Academic year</label>
                  <select
                    id="academic-year"
                    value={academicYearId}
                    onChange={(event) => {
                      setAcademicYearId(event.target.value)
                      setSchoolClassId('')
                    }}
                  >
                    {options.data.academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="grade-level">Grade level</label>
                  <select
                    id="grade-level"
                    value={gradeLevelId}
                    onChange={(event) => {
                      setGradeLevelId(event.target.value)
                      setSchoolClassId('')
                    }}
                  >
                    {options.data.gradeLevels.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="school-class">Class (optional)</label>
                  <select
                    id="school-class"
                    value={schoolClassId}
                    onChange={(event) => setSchoolClassId(event.target.value)}
                  >
                    <option value="">Not assigned</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
                <fieldset>
                  <legend>Guardian or contact (optional)</legend>
                  <div className="field">
                    <label htmlFor="guardian-name">Name</label>
                    <input
                      id="guardian-name"
                      value={guardianName}
                      onChange={(event) => setGuardianName(event.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="guardian-relationship">Relationship</label>
                    <input
                      id="guardian-relationship"
                      value={guardianRelationship}
                      onChange={(event) =>
                        setGuardianRelationship(event.target.value)
                      }
                      maxLength={100}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="guardian-phone">Phone</label>
                    <input
                      id="guardian-phone"
                      value={guardianPhone}
                      onChange={(event) => setGuardianPhone(event.target.value)}
                      maxLength={40}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="guardian-email">Email</label>
                    <input
                      id="guardian-email"
                      type="email"
                      value={guardianEmail}
                      onChange={(event) => setGuardianEmail(event.target.value)}
                    />
                  </div>
                </fieldset>
                <button type="submit" disabled={busy}>
                  {busy ? 'Registering' : 'Register student'}
                </button>
              </form>
            )}
          {formError && <p role="alert">{formError}</p>}
        </>
      )}

      {view === 'detail' && (
        <>
          <button type="button" onClick={() => setView('list')}>
            Back to students
          </button>
          {detail.status === 'loading' && <p role="status">Loading student</p>}
          {detail.status === 'error' && (
            <p role="alert">Could not load student details.</p>
          )}
          {detail.status === 'loaded' && (
            <article>
              {registration && (
                <p role="status">
                  Registered {studentName(registration.student)} as{' '}
                  <strong>{registration.student.studentReference}</strong>.
                </p>
              )}
              {registration &&
                registration.duplicateWarnings.candidates.length > 0 && (
                  <div role="alert">
                    <p>Possible duplicate students require human review.</p>
                    <ul>
                      {registration.duplicateWarnings.candidates.map(
                        (candidate) => (
                          <li key={candidate.id}>
                            {studentName(candidate)} ·{' '}
                            {candidate.studentReference}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              <h3>{studentName(detail.data.student)}</h3>
              <p>Warka reference: {detail.data.student.studentReference}</p>
              {detail.data.student.dateOfBirth && (
                <p>Date of birth: {detail.data.student.dateOfBirth}</p>
              )}
              {access.capabilities.canRegister && (
                <StudentAccountPanel
                  baseUrl={baseUrl}
                  schoolId={schoolId}
                  studentId={detail.data.student.id}
                  onSessionExpired={onSessionExpired}
                />
              )}
              {access.capabilities.canApprove && (
                <DocumentPanel
                  baseUrl={baseUrl}
                  schoolId={schoolId}
                  studentId={detail.data.student.id}
                  onSessionExpired={onSessionExpired}
                />
              )}
              <h4>Enrollments</h4>
              {detail.data.enrollments.map((enrollment) => (
                <div className="enrollment" key={enrollment.id}>
                  <p>
                    Status:{' '}
                    <span className={'status status-' + enrollment.status}>
                      {enrollment.status}
                    </span>
                  </p>
                  {enrollment.status === 'draft' &&
                    access.capabilities.canSubmit && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void enrollmentAction(enrollment.id, 'submit')
                        }
                      >
                        Submit for review
                      </button>
                    )}
                  {enrollment.status === 'pending' &&
                    access.capabilities.canApprove && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void enrollmentAction(enrollment.id, 'approve')
                        }
                      >
                        Approve enrollment
                      </button>
                    )}
                </div>
              ))}
              {detail.data.guardians.length > 0 && (
                <>
                  <h4>Guardians</h4>
                  <ul>
                    {detail.data.guardians.map(({ guardian, relationship }) => (
                      <li key={guardian.id}>
                        {guardian.name} · {relationship}
                        {guardian.phone && <> · {guardian.phone}</>}
                        {guardian.email && <> · {guardian.email}</>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {actionError && <p role="alert">{actionError}</p>}
            </article>
          )}
        </>
      )}
    </section>
  )
}
