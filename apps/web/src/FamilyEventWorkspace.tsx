import { useEffect, useState } from 'react'
import { formatDateTime } from '@warka/shared'
import { browserLocale } from './LocalizedNavigation'
import {
  eventDownloadUrl,
  getFamilyEvent,
  listFamilyEvents,
  respondToFamilyEvent,
  type SchoolEvent,
} from './eventApi'

export function FamilyEventWorkspace({
  baseUrl,
  schoolId,
  studentId,
  childName,
  locale,
}: {
  baseUrl: string
  schoolId: string
  studentId?: string
  childName?: string
  locale?: string | undefined
}) {
  const displayLocale = locale ?? browserLocale()
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<SchoolEvent | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    listFamilyEvents(baseUrl, schoolId, studentId)
      .then(({ events }) => {
        if (active) setEvents(events)
      })
      .catch(() => {
        if (active) setError('Could not load events.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, studentId, revision])
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let active = true
    getFamilyEvent(baseUrl, schoolId, selectedId, studentId)
      .then((event) => {
        if (active) setDetail(event)
      })
      .catch(() => {
        if (active) setError('Event unavailable.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, studentId, selectedId, revision])
  async function respond(status: 'going' | 'notGoing') {
    setError('')
    setMessage('')
    try {
      await respondToFamilyEvent(
        baseUrl,
        schoolId,
        selectedId,
        status,
        studentId,
      )
      setMessage('RSVP saved.')
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save RSVP.')
    }
  }
  const now = Date.now()
  const upcoming = events.filter(
    (event) => new Date(event.endsAt).getTime() >= now,
  )
  const past = events.filter((event) => new Date(event.endsAt).getTime() < now)
  return (
    <section className="academic-panel" aria-labelledby="family-events-heading">
      <h3 id="family-events-heading">
        Events{childName ? ` for ${childName}` : ''}
      </h3>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {events.length === 0 && <p>No eligible events available.</p>}
      {(
        [
          ['Upcoming events', upcoming],
          ['Past events', past],
        ] as const
      ).map(([heading, group]) => (
        <div key={heading}>
          <h4>{heading}</h4>
          <ul>
            {group.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => setSelectedId(event.id)}>
                  {event.title}
                </button>{' '}
                — {formatDateTime(event.startsAt, displayLocale)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {detail && (
        <div>
          <h4>{detail.title}</h4>
          <p>{detail.description}</p>
          <p>
            {formatDateTime(detail.startsAt, displayLocale)} –{' '}
            {formatDateTime(detail.endsAt, displayLocale)}
          </p>
          {detail.schoolLocation && (
            <p>School location: {detail.schoolLocation}</p>
          )}
          {detail.attachments?.length ? (
            <ul>
              {detail.attachments.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.available ? (
                    <a
                      href={eventDownloadUrl(
                        baseUrl,
                        schoolId,
                        detail.id,
                        attachment.id,
                      )}
                    >
                      {attachment.originalFileName}
                    </a>
                  ) : (
                    `${attachment.originalFileName} — unavailable`
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {detail.rsvpEnabled && detail.status === 'published' && (
            <div>
              <p>
                RSVP: {detail.responseStatus ?? 'No response'}. RSVP does not
                record attendance.
              </p>
              <button type="button" onClick={() => void respond('going')}>
                Going
              </button>
              <button type="button" onClick={() => void respond('notGoing')}>
                Not going
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
