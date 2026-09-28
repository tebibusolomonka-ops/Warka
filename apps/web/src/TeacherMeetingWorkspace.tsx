import { useEffect, useState } from 'react'
import { ApiError } from './api'
import {
  addTeacherMeetingSlot,
  closeTeacherMeetingSlot,
  completeTeacherMeeting,
  declineTeacherMeeting,
  listTeacherMeetings,
  listTeacherMeetingSlots,
  scheduleTeacherMeeting,
  type Meeting,
  type MeetingSlot,
} from './meetingApi'

export function TeacherMeetingWorkspace({
  baseUrl,
  schoolId,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  onSessionExpired: () => void
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [slots, setSlots] = useState<MeetingSlot[]>([])
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [method, setMethod] = useState<MeetingSlot['method']>('inPerson')
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [locations, setLocations] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      listTeacherMeetings(baseUrl, schoolId),
      listTeacherMeetingSlots(baseUrl, schoolId),
    ])
      .then(([requests, availability]) => {
        if (!active) return
        setMeetings(requests.meetings)
        setSlots(availability.slots)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setError('Could not load family meetings.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, refresh, onSessionExpired])

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
          cause instanceof Error ? cause.message : 'Meeting action failed.',
        )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="academic-panel"
      aria-labelledby="teacher-meetings-heading"
    >
      <h3 id="teacher-meetings-heading">Family meetings</h3>
      <p>
        These windows are for school meetings only. They do not show a personal
        calendar.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(
            () =>
              addTeacherMeetingSlot(baseUrl, schoolId, {
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                method,
              }),
            'Meeting window added.',
          )
        }}
      >
        <h4>Add school meeting window</h4>
        <label>
          Start{' '}
          <input
            type="datetime-local"
            value={startsAt}
            required
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>
        <label>
          End{' '}
          <input
            type="datetime-local"
            value={endsAt}
            required
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </label>
        <label>
          Method{' '}
          <select
            value={method}
            onChange={(event) =>
              setMethod(event.target.value as MeetingSlot['method'])
            }
          >
            <option value="inPerson">At school</option>
            <option value="phone">Phone</option>
            <option value="online">Online</option>
          </select>
        </label>
        <button type="submit" disabled={busy}>
          Add window
        </button>
      </form>
      <h4>Available windows</h4>
      {slots.length === 0 ? (
        <p>No meeting windows yet.</p>
      ) : (
        <ul>
          {slots.map((slot) => (
            <li key={slot.id}>
              {new Date(slot.startsAt).toLocaleString()} –{' '}
              {new Date(slot.endsAt).toLocaleString()} · {slot.method}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => closeTeacherMeetingSlot(baseUrl, schoolId, slot.id),
                    'Window closed.',
                  )
                }
              >
                Close window
              </button>
            </li>
          ))}
        </ul>
      )}
      <h4>Requests</h4>
      {meetings.length === 0 ? (
        <p>No family meeting requests.</p>
      ) : (
        <ul>
          {meetings.map((meeting) => {
            const selected = slots.find(
              (slot) => slot.id === selection[meeting.id],
            )
            return (
              <li key={meeting.id}>
                <strong>
                  {meeting.student
                    ? `${meeting.student.givenName} ${meeting.student.familyName ?? ''}`.trim()
                    : 'Student meeting'}
                </strong>
                {' · '}
                {meeting.topic}
                {' · '}
                <span>{meeting.status}</span>
                {meeting.scheduledStartAt && (
                  <p>
                    Scheduled:{' '}
                    {new Date(meeting.scheduledStartAt).toLocaleString()} ·{' '}
                    {meeting.meetingMethod}
                    {meeting.schoolLocation
                      ? ` · ${meeting.schoolLocation}`
                      : ''}
                  </p>
                )}
                {(meeting.status === 'requested' ||
                  meeting.status === 'scheduled') && (
                  <>
                    <label>
                      School meeting window{' '}
                      <select
                        value={selection[meeting.id] ?? ''}
                        onChange={(event) =>
                          setSelection((current) => ({
                            ...current,
                            [meeting.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a window</option>
                        {slots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {new Date(slot.startsAt).toLocaleString()} ·{' '}
                            {slot.method}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selected?.method === 'inPerson' && (
                      <label>
                        School location{' '}
                        <input
                          value={locations[meeting.id] ?? ''}
                          maxLength={200}
                          onChange={(event) =>
                            setLocations((current) => ({
                              ...current,
                              [meeting.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={busy || !selected}
                      onClick={() =>
                        void run(
                          () =>
                            scheduleTeacherMeeting(
                              baseUrl,
                              schoolId,
                              meeting.id,
                              selected!.id,
                              selected!.method === 'inPerson'
                                ? locations[meeting.id]
                                : undefined,
                            ),
                          meeting.status === 'scheduled'
                            ? 'Meeting rescheduled.'
                            : 'Meeting scheduled.',
                        )
                      }
                    >
                      {meeting.status === 'scheduled'
                        ? 'Reschedule'
                        : 'Schedule'}
                    </button>
                  </>
                )}
                {meeting.status === 'requested' && (
                  <>
                    <label>
                      Decline reason{' '}
                      <input
                        value={reasons[meeting.id] ?? ''}
                        maxLength={300}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [meeting.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy || (reasons[meeting.id] ?? '').trim().length < 3
                      }
                      onClick={() =>
                        void run(
                          () =>
                            declineTeacherMeeting(
                              baseUrl,
                              schoolId,
                              meeting.id,
                              reasons[meeting.id]!,
                            ),
                          'Meeting declined.',
                        )
                      }
                    >
                      Decline
                    </button>
                  </>
                )}
                {meeting.status === 'scheduled' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          completeTeacherMeeting(baseUrl, schoolId, meeting.id),
                        'Meeting completed.',
                      )
                    }
                  >
                    Mark completed
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
