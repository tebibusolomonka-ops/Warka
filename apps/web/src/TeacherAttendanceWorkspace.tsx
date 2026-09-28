import { useEffect, useState } from 'react'
import { getAcademicStructure } from './academicApi'
import {
  getOwnTeacherCalendarDays,
  getOwnTeacherTimetable,
  type ClassTimetableEntry,
} from './timetableApi'
import {
  correctAttendance,
  getAttendanceRoster,
  getAttendanceSessions,
  openAttendanceSession,
  saveAttendance,
  submitAttendance,
  type AttendanceRoster,
  type AttendanceStatus,
} from './attendanceApi'

const statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']
const date = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function TeacherAttendanceWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [yearId, setYearId] = useState('')
  const [entries, setEntries] = useState<ClassTimetableEntry[]>([])
  const [closed, setClosed] = useState('')
  const [selected, setSelected] = useState<ClassTimetableEntry | null>(null)
  const [roster, setRoster] = useState<AttendanceRoster | null>(null)
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | ''>>({})
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const today = date()
  const weekday = ((new Date().getDay() + 6) % 7) + 1

  useEffect(() => {
    let active = true
    getAcademicStructure(baseUrl, schoolId)
      .then((value) => {
        if (active) setYearId(value.academicYears[0]?.id ?? '')
      })
      .catch(() => active && setError('Could not load academic years.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId])

  useEffect(() => {
    if (!yearId) return
    let active = true
    Promise.all([
      getOwnTeacherTimetable(baseUrl, schoolId, yearId),
      getOwnTeacherCalendarDays(baseUrl, schoolId, yearId),
    ])
      .then(([schedule, days]) => {
        if (!active) return
        setEntries(
          schedule.filter(
            (entry) =>
              entry.weekday === weekday && entry.timetablePeriod.instructional,
          ),
        )
        const day = days.find((item) => item.date.slice(0, 10) === today)
        setClosed(
          day && ['closure', 'holiday', 'staffDay'].includes(day.dayType)
            ? day.dayType
            : '',
        )
      })
      .catch(() => active && setError('Could not load assigned classes.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, yearId, today, weekday])

  async function load(entry: ClassTimetableEntry) {
    setSelected(entry)
    setRoster(null)
    setError('')
    setNotice('')
    try {
      const sessions = await getAttendanceSessions(
        baseUrl,
        schoolId,
        yearId,
        entry.schoolClassId,
        today,
      )
      const session = sessions.sessions.find(
        (item) =>
          item.subjectId === entry.subjectId &&
          item.timetablePeriodId === entry.timetablePeriodId,
      )
      if (session) await refresh(session.id)
    } catch {
      setError('Could not load attendance session.')
    }
  }
  async function refresh(sessionId: string) {
    const value = await getAttendanceRoster(baseUrl, schoolId, sessionId)
    setRoster(value)
    setMarks(
      Object.fromEntries(
        value.records.map((record) => [record.studentId, record.status]),
      ),
    )
  }
  async function open() {
    if (!selected || closed) return
    try {
      const session = await openAttendanceSession(baseUrl, schoolId, {
        academicYearId: yearId,
        schoolClassId: selected.schoolClassId,
        date: today,
        timetablePeriodId: selected.timetablePeriodId,
        subjectId: selected.subjectId,
        teachingAssignmentId: selected.teachingAssignmentId,
      })
      await refresh(session.id)
    } catch {
      setError('Could not open attendance session.')
    }
  }
  async function save() {
    if (!roster) return
    try {
      await saveAttendance(
        baseUrl,
        schoolId,
        roster.session.id,
        roster.enrollments
          .filter((enrollment) => marks[enrollment.studentId])
          .map((enrollment) => ({
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            status: marks[enrollment.studentId] as AttendanceStatus,
          })),
      )
      await refresh(roster.session.id)
      setNotice('Attendance saved.')
      return true
    } catch {
      setError('Could not save attendance.')
      return false
    }
  }
  async function submit() {
    if (!roster) return
    const unrecorded = roster.enrollments.filter(
      (enrollment) => !marks[enrollment.studentId],
    ).length
    if (unrecorded) {
      setError(
        `${unrecorded} students are unrecorded. Record each student before submission.`,
      )
      return
    }
    try {
      if (!(await save())) return
      await submitAttendance(baseUrl, schoolId, roster.session.id)
      await refresh(roster.session.id)
      setNotice('Attendance submitted.')
    } catch {
      setError('Could not submit attendance.')
    }
  }
  async function correct(recordId: string, status: AttendanceStatus) {
    if (!roster || reason.trim().length < 8) {
      setError('Enter a correction reason of at least 8 characters.')
      return
    }
    try {
      await correctAttendance(baseUrl, schoolId, recordId, status, reason)
      await refresh(roster.session.id)
      setReason('')
      setNotice('Correction saved.')
    } catch {
      setError('Could not correct attendance.')
    }
  }

  return (
    <section id="teacher-attendance" aria-label="Daily attendance">
      <h2>Daily attendance</h2>
      <p>Today: {today}</p>
      {closed && <p role="status">Attendance is closed today: {closed}.</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        Assigned class{' '}
        <select
          value={selected?.id ?? ''}
          onChange={(event) => {
            const entry = entries.find((item) => item.id === event.target.value)
            if (entry) void load(entry)
          }}
        >
          <option value="">Choose a class</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.schoolClass?.name ?? 'Class'} · {entry.subject.name} ·{' '}
              {entry.timetablePeriod.name}
            </option>
          ))}
        </select>
      </label>
      {selected && !roster && !closed && (
        <button onClick={() => void open()}>Open attendance session</button>
      )}
      {roster && (
        <>
          <p>Session: {roster.session.status}</p>
          <p aria-live="polite">
            Unrecorded:{' '}
            {
              roster.enrollments.filter(
                (enrollment) => !marks[enrollment.studentId],
              ).length
            }
          </p>
          <table>
            <caption>Eligible enrolled students</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Attendance</th>
                <th scope="col">Correction</th>
              </tr>
            </thead>
            <tbody>
              {roster.enrollments.map((enrollment) => {
                const record = roster.records.find(
                  (item) => item.studentId === enrollment.studentId,
                )
                return (
                  <tr key={enrollment.id}>
                    <td>
                      {enrollment.student.givenName}{' '}
                      {enrollment.student.familyName}
                    </td>
                    <td>
                      <label>
                        <span className="sr-only">
                          Status for {enrollment.student.givenName}
                        </span>
                        <select
                          value={marks[enrollment.studentId] ?? ''}
                          disabled={
                            roster.session.status === 'finalized' ||
                            roster.session.status === 'cancelled'
                          }
                          onChange={(event) =>
                            setMarks((current) => ({
                              ...current,
                              [enrollment.studentId]: event.target.value as
                                AttendanceStatus | '',
                            }))
                          }
                        >
                          <option value="">Unrecorded</option>
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td>
                      {record && roster.session.status === 'submitted' && (
                        <button
                          onClick={() =>
                            void correct(
                              record.id,
                              marks[enrollment.studentId] as AttendanceStatus,
                            )
                          }
                        >
                          Apply correction
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {roster.session.status === 'open' && (
            <>
              <button onClick={() => void save()}>Save attendance</button>
              <button onClick={() => void submit()}>Submit attendance</button>
            </>
          )}
          {roster.session.status === 'submitted' && (
            <label>
              Correction reason{' '}
              <input
                value={reason}
                minLength={8}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
        </>
      )}
    </section>
  )
}
