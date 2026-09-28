import { useEffect, useState } from 'react'
import { getAcademicStructure } from './academicApi'
import {
  getOwnTeacherCalendarDays,
  getOwnTeacherTimetable,
  type ClassTimetableEntry,
  type SchoolCalendarDay,
} from './timetableApi'

const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export function TeacherTimetableWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [years, setYears] = useState<Array<{ id: string; name: string }>>([])
  const [yearId, setYearId] = useState('')
  const [entries, setEntries] = useState<ClassTimetableEntry[]>([])
  const [days, setDays] = useState<SchoolCalendarDay[]>([])
  const [view, setView] = useState<'today' | 'week'>('today')
  const [error, setError] = useState('')
  const now = new Date()
  const todayWeekday = ((now.getDay() + 6) % 7) + 1
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayException = days.find((day) => day.date.slice(0, 10) === localDate)

  useEffect(() => {
    let active = true
    getAcademicStructure(baseUrl, schoolId)
      .then((value) => {
        if (!active) return
        setYears(value.academicYears)
        setYearId((current) => current || value.academicYears[0]?.id || '')
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
      .then(([schedule, calendar]) => {
        if (active) {
          setEntries(schedule)
          setDays(calendar)
        }
      })
      .catch(() => active && setError('Could not load your timetable.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, yearId])

  const visible =
    view === 'today'
      ? entries.filter((entry) => entry.weekday === todayWeekday)
      : entries
  return (
    <section id="teacher-timetable" aria-label="My timetable">
      <h2>My timetable</h2>
      {error && <p role="alert">{error}</p>}
      <label>
        Timetable year{' '}
        <select
          value={yearId}
          onChange={(event) => setYearId(event.target.value)}
        >
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Timetable view">
        <button
          aria-pressed={view === 'today'}
          onClick={() => setView('today')}
        >
          Today
        </button>
        <button aria-pressed={view === 'week'} onClick={() => setView('week')}>
          Week
        </button>
      </div>
      {todayException && (
        <p role="status">
          Today is configured as {todayException.dayType}
          {todayException.label ? `: ${todayException.label}` : ''}.
        </p>
      )}
      <table>
        <caption>
          {view === 'today'
            ? "Today's assigned lessons"
            : 'Weekly assigned lessons'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Time</th>
            <th scope="col">Class</th>
            <th scope="col">Subject</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry) => (
            <tr key={entry.id}>
              <td>{weekdays[entry.weekday - 1]}</td>
              <td>
                {entry.timetablePeriod.name} · {entry.timetablePeriod.startTime}
                –{entry.timetablePeriod.endTime}
              </td>
              <td>{entry.schoolClass?.name ?? 'Class'}</td>
              <td>{entry.subject.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 && <p>No assigned lessons in this view.</p>}
      <p>
        Only published lessons covered by your active teaching assignments
        appear here.
      </p>
    </section>
  )
}
