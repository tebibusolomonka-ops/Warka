import { useEffect, useState } from 'react'
import { requestJson } from './api'
import {
  getAcademicStructure,
  type AcademicStructure,
  type Assessment,
} from './academicApi'
import {
  assignInvigilator,
  createRoom,
  createSchedule,
  getAssessmentRooms,
  getAssessmentRoster,
  getAssessmentSchedules,
  getMakeUps,
  recordParticipation,
  requestMakeUp,
  reviewMakeUp,
  scheduleMakeUp,
  transitionSchedule,
  transitionSession,
  validateSchedule,
  type AssessmentRoom,
  type AssessmentRosterRow,
  type AssessmentSchedule,
  type MakeUpRequest,
  type ScheduleIssue,
} from './assessmentScheduleApi'

export function AssessmentCalendarWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [structure, setStructure] = useState<AcademicStructure | null>(null)
  const [rooms, setRooms] = useState<AssessmentRoom[]>([])
  const [schedules, setSchedules] = useState<AssessmentSchedule[]>([])
  const [makeUps, setMakeUps] = useState<MakeUpRequest[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [yearId, setYearId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [assessmentId, setAssessmentId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [capacity, setCapacity] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [roster, setRoster] = useState<AssessmentRosterRow[]>([])
  const [invigilatorId, setInvigilatorId] = useState('')
  const [makeUpReason, setMakeUpReason] = useState('')
  const [issues, setIssues] = useState<Record<string, ScheduleIssue[]>>({})
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAcademicStructure(baseUrl, schoolId)
      .then((value) => {
        if (!active) return
        setStructure(value)
        setYearId((current) => current || value.academicYears[0]?.id || '')
      })
      .catch(() => active && setError('Could not load academic structure.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId])

  useEffect(() => {
    const periods =
      structure?.gradingPeriods.filter(
        (item) => item.academicYearId === yearId,
      ) ?? []
    const classes =
      structure?.classes.filter((item) => item.academicYearId === yearId) ?? []
    if (!periods.some((item) => item.id === periodId))
      setPeriodId(periods[0]?.id ?? '')
    if (!classes.some((item) => item.id === classId))
      setClassId(classes[0]?.id ?? '')
    if (!structure?.subjects.some((item) => item.id === subjectId))
      setSubjectId(structure?.subjects[0]?.id ?? '')
  }, [structure, yearId, periodId, classId, subjectId])

  useEffect(() => {
    let active = true
    Promise.all([
      getAssessmentRooms(baseUrl, schoolId),
      getAssessmentSchedules(baseUrl, schoolId, yearId || undefined),
      getMakeUps(baseUrl, schoolId),
    ])
      .then(([nextRooms, nextSchedules, nextMakeUps]) => {
        if (!active) return
        setRooms(nextRooms)
        setSchedules(nextSchedules)
        setMakeUps(nextMakeUps)
      })
      .catch(() => active && setError('Could not load assessment calendar.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, yearId, revision])

  useEffect(() => {
    if (!yearId || !periodId || !classId || !subjectId) return
    let active = true
    const query = new URLSearchParams({
      academicYearId: yearId,
      gradingPeriodId: periodId,
      schoolClassId: classId,
      subjectId,
    })
    requestJson(
      baseUrl,
      `/schools/${encodeURIComponent(schoolId)}/assessments?${query}`,
    )
      .then((result) => {
        if (!active) return
        const values = result as Assessment[]
        setAssessments(values)
        setAssessmentId((current) =>
          values.some((item) => item.id === current)
            ? current
            : (values[0]?.id ?? ''),
        )
      })
      .catch(() => active && setError('Could not load assessment definitions.'))
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, yearId, periodId, classId, subjectId])

  useEffect(() => {
    if (!selectedSessionId) return
    let active = true
    getAssessmentRoster(baseUrl, schoolId, selectedSessionId)
      .then((rows) => active && setRoster(rows))
      .catch(
        () => active && setError('Could not load assessment participation.'),
      )
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, selectedSessionId, revision])

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Assessment action failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const visible = schedules.filter(
    (item) =>
      (!periodId || item.gradingPeriodId === periodId) &&
      (!classId || item.schoolClassId === classId) &&
      (!subjectId || item.subjectId === subjectId),
  )
  const selectedSession = schedules
    .flatMap((item) =>
      item.sessions.map((session) => ({ ...session, schedule: item })),
    )
    .find((item) => item.id === selectedSessionId)

  return (
    <section aria-label="Assessment calendar">
      <h2>Assessment calendar</h2>
      <p>
        Schedules, participation, and make-up requests remain separate from
        marks. An absent student has no automatic zero score.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="field">
        <label htmlFor="assessment-year">Academic year</label>
        <select
          id="assessment-year"
          value={yearId}
          onChange={(event) => setYearId(event.target.value)}
        >
          {structure?.academicYears.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="assessment-period">Grading period</label>
        <select
          id="assessment-period"
          value={periodId}
          onChange={(event) => setPeriodId(event.target.value)}
        >
          {structure?.gradingPeriods
            .filter((item) => item.academicYearId === yearId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="assessment-class">Class</label>
        <select
          id="assessment-class"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          {structure?.classes
            .filter((item) => item.academicYearId === yearId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="assessment-subject">Subject</label>
        <select
          id="assessment-subject"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        >
          {structure?.subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <h3>Rooms</h3>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            {room.name} ({room.code}) —{' '}
            {room.capacity ? `${room.capacity} places` : 'capacity unspecified'}{' '}
            {room.active ? '' : '(inactive)'}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(
            () =>
              createRoom(baseUrl, schoolId, {
                name: roomName,
                code: roomCode,
                ...(capacity ? { capacity: Number(capacity) } : {}),
              }),
            'Room created.',
          )
        }}
      >
        <label>
          Room name{' '}
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            required
            maxLength={80}
          />
        </label>
        <label>
          Room code{' '}
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            required
            maxLength={24}
          />
        </label>
        <label>
          Capacity{' '}
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </label>
        <button disabled={busy} type="submit">
          Add room
        </button>
      </form>
      <h3>Schedule assessment</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(
            () =>
              createSchedule(baseUrl, schoolId, {
                academicYearId: yearId,
                gradingPeriodId: periodId,
                schoolClassId: classId,
                subjectId,
                assessmentId,
                ...(roomId ? { roomId } : {}),
                scheduledDate: date,
                startTime,
                endTime,
              }),
            'Draft assessment schedule created.',
          )
        }}
      >
        <label>
          Assessment definition{' '}
          <select
            value={assessmentId}
            onChange={(event) => setAssessmentId(event.target.value)}
          >
            {assessments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date{' '}
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label>
          Start time{' '}
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>
        <label>
          End time{' '}
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            required
          />
        </label>
        <label>
          Room{' '}
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
          >
            <option value="">No room</option>
            {rooms
              .filter((room) => room.active)
              .map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
          </select>
        </label>
        <button disabled={busy || !assessmentId} type="submit">
          Create draft
        </button>
      </form>
      <h3>Schedules</h3>
      {visible.length === 0 && (
        <p>No assessments scheduled for these filters.</p>
      )}
      <ul>
        {visible.map((item) => (
          <li key={item.id}>
            <strong>{item.assessment.name}</strong> —{' '}
            {item.scheduledDate.slice(0, 10)} {item.startTime}–{item.endTime};{' '}
            {item.status}; {item.room?.name ?? 'no room'}
            {item.room?.capacity && <span> ({item.room.capacity} places)</span>}
            {issues[item.id]?.length ? (
              <ul aria-label="Blocking conflicts">
                {issues[item.id]?.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.code}</li>
                ))}
              </ul>
            ) : null}
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await validateSchedule(
                    baseUrl,
                    schoolId,
                    item.id,
                  )
                  setIssues((current) => ({
                    ...current,
                    [item.id]: result.issues,
                  }))
                }, 'Schedule validated.')
              }
            >
              Validate
            </button>
            {item.status === 'draft' && (
              <button
                disabled={busy || Boolean(issues[item.id]?.length)}
                onClick={() =>
                  void run(
                    () =>
                      transitionSchedule(
                        baseUrl,
                        schoolId,
                        item.id,
                        'schedule',
                      ),
                    'Assessment scheduled.',
                  )
                }
              >
                Schedule
              </button>
            )}
            {['draft', 'scheduled'].includes(item.status) && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      transitionSchedule(baseUrl, schoolId, item.id, 'cancel'),
                    'Assessment cancelled.',
                  )
                }
              >
                Cancel
              </button>
            )}
            {item.status === 'scheduled' && item.sessions.length === 0 && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      transitionSchedule(baseUrl, schoolId, item.id, 'session'),
                    'Session planned.',
                  )
                }
              >
                Plan session
              </button>
            )}
            {item.sessions.map((session) => (
              <div key={session.id}>
                <span>Session: {session.status}</span>
                <button onClick={() => setSelectedSessionId(session.id)}>
                  Participation
                </button>
                {session.status === 'planned' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          transitionSession(
                            baseUrl,
                            schoolId,
                            session.id,
                            'open',
                          ),
                        'Session opened.',
                      )
                    }
                  >
                    Open session
                  </button>
                )}
                {session.status === 'open' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          transitionSession(
                            baseUrl,
                            schoolId,
                            session.id,
                            'complete',
                          ),
                        'Session completed.',
                      )
                    }
                  >
                    Complete session
                  </button>
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>
      {selectedSession && (
        <section aria-label="Assessment participation">
          <h3>Participation — {selectedSession.schedule.assessment.name}</h3>
          <label>
            Invigilator user{' '}
            <select
              value={invigilatorId}
              onChange={(event) => setInvigilatorId(event.target.value)}
            >
              <option value="">Choose staff</option>
              {structure?.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.displayName}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !invigilatorId}
            onClick={() =>
              void run(
                () =>
                  assignInvigilator(
                    baseUrl,
                    schoolId,
                    selectedSession.id,
                    invigilatorId,
                  ),
                'Invigilator assigned.',
              )
            }
          >
            Assign invigilator
          </button>
          <table>
            <caption>Student participation is separate from marks</caption>
            <thead>
              <tr>
                <th>Student</th>
                <th>Participation</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => (
                <tr key={row.studentId}>
                  <th scope="row">
                    {row.reference} {row.name}
                  </th>
                  <td>
                    {row.participation?.status ?? 'Missing participation'}
                  </td>
                  <td>
                    {!row.participation &&
                      selectedSession.status === 'open' && (
                        <>
                          {(['present', 'absent', 'excused'] as const).map(
                            (status) => (
                              <button
                                key={status}
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    () =>
                                      recordParticipation(
                                        baseUrl,
                                        schoolId,
                                        selectedSession.id,
                                        row.studentId,
                                        status,
                                      ),
                                    'Participation recorded.',
                                  )
                                }
                              >
                                {status}
                              </button>
                            ),
                          )}
                        </>
                      )}
                    {row.participation?.status === 'absent' && (
                      <button
                        disabled={busy || !makeUpReason.trim()}
                        onClick={() =>
                          void run(
                            () =>
                              requestMakeUp(
                                baseUrl,
                                schoolId,
                                row.participation!.id,
                                makeUpReason,
                              ),
                            'Make-up requested.',
                          )
                        }
                      >
                        Request make-up
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <label>
            Make-up reason{' '}
            <input
              value={makeUpReason}
              onChange={(event) => setMakeUpReason(event.target.value)}
              maxLength={1000}
            />
          </label>
        </section>
      )}
      <h3>Make-up assessments</h3>
      <ul>
        {makeUps.map((item) => (
          <li key={item.id}>
            Student {item.studentId}: {item.status} — {item.reason}
            {item.status === 'requested' && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        reviewMakeUp(baseUrl, schoolId, item.id, 'approved'),
                      'Make-up approved.',
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
                        reviewMakeUp(baseUrl, schoolId, item.id, 'rejected'),
                      'Make-up rejected.',
                    )
                  }
                >
                  Reject
                </button>
              </>
            )}
            {item.status === 'approved' && (
              <button
                disabled={busy || !date}
                onClick={() =>
                  void run(
                    () =>
                      scheduleMakeUp(baseUrl, schoolId, item.id, {
                        scheduledDate: date,
                        startTime,
                        endTime,
                      }),
                    'Make-up scheduled.',
                  )
                }
              >
                Schedule make-up at selected date and time
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
