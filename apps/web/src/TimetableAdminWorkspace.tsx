import { useEffect, useState } from 'react'
import {
  getAcademicStructure,
  getTeachingAssignments,
  type AcademicStructure,
  type TeachingAssignment,
} from './academicApi'
import {
  addClassTimetableEntry,
  addSchoolCalendarDay,
  addTimetablePeriod,
  createTimetableDraft,
  getClassTimetable,
  getClassTimetables,
  getSchoolCalendarDays,
  getTimetablePeriods,
  removeClassTimetableEntry,
  transitionClassTimetable,
  validateClassTimetable,
  type ClassTimetable,
  type ClassTimetableEntry,
  type SchoolCalendarDay,
  type TimetablePeriod,
  type TimetableProblem,
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

export function TimetableAdminWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [structure, setStructure] = useState<AcademicStructure | null>(null)
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([])
  const [periods, setPeriods] = useState<TimetablePeriod[]>([])
  const [days, setDays] = useState<SchoolCalendarDay[]>([])
  const [plans, setPlans] = useState<ClassTimetable[]>([])
  const [entries, setEntries] = useState<ClassTimetableEntry[]>([])
  const [problems, setProblems] = useState<TimetableProblem[]>([])
  const [validated, setValidated] = useState(false)
  const [yearId, setYearId] = useState('')
  const [classId, setClassId] = useState('')
  const [planId, setPlanId] = useState('')
  const [periodName, setPeriodName] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('08:45')
  const [calendarDate, setCalendarDate] = useState('')
  const [dayType, setDayType] =
    useState<SchoolCalendarDay['dayType']>('instructional')
  const [dayLabel, setDayLabel] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [weekday, setWeekday] = useState(1)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      getAcademicStructure(baseUrl, schoolId),
      getTeachingAssignments(baseUrl, schoolId),
      getTimetablePeriods(baseUrl, schoolId),
    ])
      .then(([nextStructure, nextAssignments, nextPeriods]) => {
        if (!active) return
        setStructure(nextStructure)
        setAssignments(nextAssignments)
        setPeriods(nextPeriods)
        setYearId(
          (current) => current || nextStructure.academicYears[0]?.id || '',
        )
      })
      .catch(
        () => active && setError('Could not load timetable configuration.'),
      )
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, revision])

  useEffect(() => {
    const available =
      structure?.classes.filter((item) => item.academicYearId === yearId) ?? []
    if (!available.some((item) => item.id === classId))
      setClassId(available[0]?.id ?? '')
  }, [structure, yearId, classId])

  useEffect(() => {
    if (!yearId || !classId) return
    let active = true
    Promise.all([
      getClassTimetables(baseUrl, schoolId, yearId, classId),
      getSchoolCalendarDays(baseUrl, schoolId, yearId),
    ])
      .then(([nextPlans, nextDays]) => {
        if (!active) return
        setPlans(nextPlans)
        setDays(nextDays)
        setPlanId((current) =>
          nextPlans.some((plan) => plan.id === current)
            ? current
            : (nextPlans.find((plan) => plan.status === 'draft')?.id ??
              nextPlans[0]?.id ??
              ''),
        )
      })
      .catch(() => active && setError('Could not load timetable.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, yearId, classId, revision])

  useEffect(() => {
    if (!planId) {
      setEntries([])
      setProblems([])
      return
    }
    let active = true
    getClassTimetable(baseUrl, schoolId, planId)
      .then((value) => {
        if (active) {
          setEntries(value.entries)
          setProblems([])
          setValidated(false)
        }
      })
      .catch(() => active && setError('Could not load timetable entries.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, planId, revision])

  const selectedPlan = plans.find((plan) => plan.id === planId)
  const availableAssignments = assignments.filter(
    (item) => item.academicYearId === yearId && item.schoolClassId === classId,
  )
  const chosenAssignment =
    availableAssignments.find((item) => item.id === assignmentId) ??
    availableAssignments[0]
  const chosenPeriod =
    periods.find((item) => item.id === periodId) ??
    periods.find((item) => item.instructional)
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setRevision((value) => value + 1)
    } catch {
      setError(
        'Timetable action could not be completed. Check scope and conflicts.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="timetable-admin" aria-label="Timetable administration">
      <h2>Timetable administration</h2>
      <p>
        Configure academic days, periods, and class schedules. Blocking
        conflicts must be resolved before publication.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <label>
        Academic year{' '}
        <select
          value={yearId}
          onChange={(event) => setYearId(event.target.value)}
        >
          {structure?.academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Class{' '}
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          {structure?.classes
            .filter((item) => item.academicYearId === yearId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.gradeLevelName} {item.name}
              </option>
            ))}
        </select>
      </label>

      <h3>Periods</h3>
      <ul>
        {periods.map((period) => (
          <li key={period.id}>
            {period.name}: {period.startTime}–{period.endTime}
            {period.instructional ? '' : ' (non-instructional)'}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(
            () =>
              addTimetablePeriod(baseUrl, schoolId, {
                name: periodName,
                startTime,
                endTime,
                sortOrder: periods.length + 1,
                instructional: true,
              }),
            'Period added',
          )
        }}
      >
        <label>
          Period name{' '}
          <input
            value={periodName}
            onChange={(event) => setPeriodName(event.target.value)}
            required
          />
        </label>
        <label>
          Starts{' '}
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>
        <label>
          Ends{' '}
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            required
          />
        </label>
        <button disabled={busy}>Add period</button>
      </form>

      <h3>Calendar days</h3>
      <ul>
        {days.map((day) => (
          <li key={day.id}>
            {day.date.slice(0, 10)}: {day.dayType}
            {day.label ? ` — ${day.label}` : ''}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(
            () =>
              addSchoolCalendarDay(baseUrl, schoolId, {
                academicYearId: yearId,
                date: calendarDate,
                dayType,
                label: dayLabel || null,
              }),
            'Calendar day added',
          )
        }}
      >
        <label>
          Date{' '}
          <input
            type="date"
            value={calendarDate}
            onChange={(event) => setCalendarDate(event.target.value)}
            required
          />
        </label>
        <label>
          Day type{' '}
          <select
            value={dayType}
            onChange={(event) =>
              setDayType(event.target.value as SchoolCalendarDay['dayType'])
            }
          >
            <option value="instructional">Instructional</option>
            <option value="holiday">Holiday</option>
            <option value="closure">Closure</option>
            <option value="examination">Examination</option>
            <option value="staffDay">Staff day</option>
          </select>
        </label>
        <label>
          Label{' '}
          <input
            value={dayLabel}
            maxLength={160}
            onChange={(event) => setDayLabel(event.target.value)}
          />
        </label>
        <button disabled={busy || !yearId}>Add calendar day</button>
      </form>

      <h3>Class timetable</h3>
      <label>
        Version{' '}
        <select
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
        >
          <option value="">Select a version</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.status} · {plan.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      {!plans.some((plan) => plan.status === 'draft') && (
        <button
          disabled={busy || !classId}
          onClick={() =>
            void run(async () => {
              const plan = await createTimetableDraft(
                baseUrl,
                schoolId,
                yearId,
                classId,
              )
              setPlanId(plan.id)
            }, 'Draft created')
          }
        >
          Create draft
        </button>
      )}
      <table>
        <caption>Weekly class timetable</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {periods
              .filter((period) => period.instructional)
              .map((period) => (
                <th scope="col" key={period.id}>
                  {period.name}
                  <br />
                  {period.startTime}–{period.endTime}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {weekdays.map((day, index) => (
            <tr key={day}>
              <th scope="row">{day}</th>
              {periods
                .filter((period) => period.instructional)
                .map((period) => {
                  const entry = entries.find(
                    (item) =>
                      item.weekday === index + 1 &&
                      item.timetablePeriod.id === period.id,
                  )
                  return (
                    <td key={period.id}>
                      {entry ? (
                        <>
                          {entry.subject.name}
                          {selectedPlan?.status === 'draft' && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () =>
                                    removeClassTimetableEntry(
                                      baseUrl,
                                      schoolId,
                                      planId,
                                      entry.id,
                                    ),
                                  'Entry removed',
                                )
                              }
                            >
                              Remove {day} {period.name}
                            </button>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedPlan?.status === 'draft' && (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!chosenAssignment || !chosenPeriod) return
              void run(
                () =>
                  addClassTimetableEntry(baseUrl, schoolId, planId, {
                    subjectId: chosenAssignment.subjectId,
                    teachingAssignmentId: chosenAssignment.id,
                    timetablePeriodId: chosenPeriod.id,
                    weekday,
                  }),
                'Entry added',
              )
            }}
          >
            <label>
              Teaching assignment{' '}
              <select
                value={chosenAssignment?.id ?? ''}
                onChange={(event) => setAssignmentId(event.target.value)}
              >
                {availableAssignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {structure?.subjects.find(
                      (subject) => subject.id === item.subjectId,
                    )?.name ?? 'Subject'}{' '}
                    ·{' '}
                    {structure?.teachers.find(
                      (teacher) => teacher.id === item.userId,
                    )?.displayName ?? 'Teacher'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Day{' '}
              <select
                value={weekday}
                onChange={(event) => setWeekday(Number(event.target.value))}
              >
                {weekdays.map((day, index) => (
                  <option key={day} value={index + 1}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period{' '}
              <select
                value={chosenPeriod?.id ?? ''}
                onChange={(event) => setPeriodId(event.target.value)}
              >
                {periods
                  .filter((period) => period.instructional)
                  .map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy || !chosenAssignment || !chosenPeriod}>
              Add entry
            </button>
          </form>
          <button
            disabled={busy}
            onClick={() =>
              void validateClassTimetable(baseUrl, schoolId, planId)
                .then((found) => {
                  setProblems(found)
                  setValidated(true)
                })
                .catch(() => setError('Could not validate timetable.'))
            }
          >
            Validate timetable
          </button>
          <button
            disabled={
              busy || entries.length === 0 || !validated || problems.length > 0
            }
            onClick={() =>
              void run(
                () =>
                  transitionClassTimetable(
                    baseUrl,
                    schoolId,
                    planId,
                    'publish',
                  ),
                'Timetable published',
              )
            }
          >
            Publish timetable
          </button>
        </>
      )}
      {problems.length > 0 && (
        <div role="alert">
          <h4>Blocking conflicts</h4>
          <ul>
            {problems.map((problem, index) => (
              <li key={`${problem.entryId}-${index}`}>{problem.code}</li>
            ))}
          </ul>
        </div>
      )}
      {selectedPlan && selectedPlan.status !== 'archived' && (
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                transitionClassTimetable(baseUrl, schoolId, planId, 'archive'),
              'Timetable archived',
            )
          }
        >
          Archive timetable
        </button>
      )}
      <p>Teaching assignments are managed in Academic setup.</p>
    </section>
  )
}
