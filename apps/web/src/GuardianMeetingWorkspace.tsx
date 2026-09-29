import { useEffect, useState } from 'react'
import { ApiError } from './api'
import { FormErrorSummary } from './FormErrorSummary'
import { AsyncStatus } from './AsyncStatus'
import {
  cancelGuardianMeeting,
  listChildMeetingTeachers,
  listChildTeacherSlots,
  listGuardianMeetings,
  requestGuardianMeeting,
  type ChildMeetingTeacher,
  type Meeting,
  type MeetingSlot,
} from './meetingApi'

export function GuardianMeetingWorkspace({
  baseUrl,
  schoolId,
  studentId,
  childName,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  studentId: string
  childName: string
  onSessionExpired: () => void
}) {
  const [teachers, setTeachers] = useState<ChildMeetingTeacher[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [teacherId, setTeacherId] = useState('')
  const [slots, setSlots] = useState<MeetingSlot[]>([])
  const [topic, setTopic] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    setTeacherId('')
    setSlots([])
    Promise.all([
      listChildMeetingTeachers(baseUrl, schoolId, studentId),
      listGuardianMeetings(baseUrl, schoolId),
    ])
      .then(([people, requests]) => {
        if (!active) return
        setTeachers(people.teachers)
        setMeetings(
          requests.meetings.filter((item) => item.studentId === studentId),
        )
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
  }, [baseUrl, schoolId, studentId, refresh, onSessionExpired])
  useEffect(() => {
    if (!teacherId) return
    let active = true
    const teacherUserId = teachers.find(
      (person) => person.assignmentId === teacherId,
    )?.teacherId
    if (!teacherUserId) return
    listChildTeacherSlots(baseUrl, schoolId, studentId, teacherUserId)
      .then((value) => {
        if (active) setSlots(value.slots)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setError('Could not load meeting windows.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, studentId, teacherId, teachers, onSessionExpired])
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
  const selected = teachers.find((person) => person.assignmentId === teacherId)
  return (
    <section
      className="academic-panel"
      aria-labelledby="guardian-meetings-heading"
    >
      <h3 id="guardian-meetings-heading">Family meetings for {childName}</h3>
      <p>
        Request a school meeting with a current teacher. Times shown are school
        meeting windows.
      </p>
      <FormErrorSummary id="meeting-error" message={error} />
      {message && <AsyncStatus message={message} />}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!selected) return
          void run(
            () =>
              requestGuardianMeeting(
                baseUrl,
                schoolId,
                studentId,
                selected.assignmentId,
                topic,
              ),
            'Meeting requested.',
          )
        }}
      >
        <label>
          Current teacher{' '}
          <select
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
            required
          >
            <option value="">Choose teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.assignmentId} value={teacher.assignmentId}>
                {teacher.teacherName} · {teacher.subjectName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Topic{' '}
          <textarea
            aria-invalid={!!error}
            aria-describedby={error ? 'meeting-error' : undefined}
            value={topic}
            minLength={3}
            maxLength={300}
            required
            onChange={(event) => setTopic(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !selected || topic.trim().length < 3}
        >
          Request meeting
        </button>
      </form>
      {selected && (
        <div>
          <h4>Available school windows</h4>
          {slots.length ? (
            <ul>
              {slots.map((slot) => (
                <li key={slot.id}>
                  {new Date(slot.startsAt).toLocaleString()} · {slot.method}
                </li>
              ))}
            </ul>
          ) : (
            <p>No windows posted yet. You can still request a meeting.</p>
          )}
        </div>
      )}
      <h4>Requests for {childName}</h4>
      {meetings.length === 0 ? (
        <p>No meeting requests for this child.</p>
      ) : (
        <ul>
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <strong>{meeting.topic}</strong> · {meeting.status}
              {meeting.scheduledStartAt && (
                <p>
                  {new Date(meeting.scheduledStartAt).toLocaleString()} ·{' '}
                  {meeting.meetingMethod}
                  {meeting.schoolLocation ? ` · ${meeting.schoolLocation}` : ''}
                </p>
              )}
              {meeting.events?.[0]?.reason && (
                <p>Reason: {meeting.events[0].reason}</p>
              )}
              {(meeting.status === 'requested' ||
                meeting.status === 'scheduled') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        cancelGuardianMeeting(baseUrl, schoolId, meeting.id),
                      'Meeting cancelled.',
                    )
                  }
                >
                  Cancel request
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
