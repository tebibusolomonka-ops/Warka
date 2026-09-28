import { useEffect, useState, type FormEvent } from 'react'
import { getAcademicStructure, type AcademicStructure } from './academicApi'
import {
  createEvent,
  eventResponseCounts,
  listEventAttachments,
  listManagedEvents,
  setEventAudience,
  setEventRsvp,
  transitionEvent,
  updateEvent,
  uploadEventAttachment,
  type SchoolEvent,
} from './eventApi'

const empty = {
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  schoolLocation: '',
}
const dateInput = (value: string) =>
  value ? new Date(value).toISOString().slice(0, 16) : ''

export function SchoolEventWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [structure, setStructure] = useState<AcademicStructure | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(empty)
  const [scope, setScope] = useState('wholeSchool')
  const [schoolClassId, setSchoolClassId] = useState('')
  const [rsvpEnabled, setRsvpEnabled] = useState(false)
  const [attachments, setAttachments] = useState<
    { id: string; originalFileName: string; status: string }[]
  >([])
  const [counts, setCounts] = useState<{
    going: number
    notGoing: number
  } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const selected = events.find((event) => event.id === selectedId)

  useEffect(() => {
    let active = true
    listManagedEvents(baseUrl, schoolId)
      .then(({ events }) => {
        if (active) setEvents(events)
      })
      .catch(() => {
        if (active) setError('Could not load school events.')
      })
    getAcademicStructure(baseUrl, schoolId)
      .then((value) => {
        if (active) setStructure(value)
      })
      .catch(() => {
        if (active) setStructure(null)
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, revision])

  useEffect(() => {
    if (!selected) {
      setForm(empty)
      setAttachments([])
      setCounts(null)
      return
    }
    setForm({
      title: selected.title,
      description: selected.description,
      startsAt: dateInput(selected.startsAt),
      endsAt: dateInput(selected.endsAt),
      schoolLocation: selected.schoolLocation ?? '',
    })
    setScope(selected.audience?.scope ?? 'wholeSchool')
    setSchoolClassId(selected.audience?.schoolClassId ?? '')
    setRsvpEnabled(selected.rsvpEnabled)
    listEventAttachments(baseUrl, schoolId, selected.id)
      .then(({ attachments }) => setAttachments(attachments))
      .catch(() => setAttachments([]))
    eventResponseCounts(baseUrl, schoolId, selected.id)
      .then(setCounts)
      .catch(() => setCounts(null))
  }, [baseUrl, schoolId, selectedId, revision])

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await task()
      setMessage(success)
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Event action failed.')
    } finally {
      setBusy(false)
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = {
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      ...(form.schoolLocation ? { schoolLocation: form.schoolLocation } : {}),
    }
    await run(
      async () => {
        if (selected) await updateEvent(baseUrl, schoolId, selected.id, body)
        else {
          const created = await createEvent(baseUrl, schoolId, body)
          setSelectedId(created.id)
        }
      },
      selected ? 'Draft updated.' : 'Draft created.',
    )
  }
  return (
    <section className="academic-panel" aria-labelledby="school-events-heading">
      <h2 id="school-events-heading">School events</h2>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <label>
        Event{' '}
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">New draft</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} — {event.status}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={save}>
        <label>
          Title{' '}
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            disabled={
              selected?.status !== undefined && selected.status !== 'draft'
            }
          />
        </label>
        <label>
          Description{' '}
          <textarea
            required
            maxLength={5000}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            disabled={
              selected?.status !== undefined && selected.status !== 'draft'
            }
          />
        </label>
        <label>
          Starts{' '}
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) =>
              setForm({ ...form, startsAt: event.target.value })
            }
            disabled={
              selected?.status !== undefined && selected.status !== 'draft'
            }
          />
        </label>
        <label>
          Ends{' '}
          <input
            required
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) =>
              setForm({ ...form, endsAt: event.target.value })
            }
            disabled={
              selected?.status !== undefined && selected.status !== 'draft'
            }
          />
        </label>
        <label>
          School location{' '}
          <input
            maxLength={200}
            value={form.schoolLocation}
            onChange={(event) =>
              setForm({ ...form, schoolLocation: event.target.value })
            }
            disabled={
              selected?.status !== undefined && selected.status !== 'draft'
            }
          />
        </label>
        {(!selected || selected.status === 'draft') && (
          <button type="submit" disabled={busy}>
            Save draft
          </button>
        )}
      </form>
      {selected && (
        <>
          <p>Status: {selected.status}</p>
          {selected.status === 'draft' && (
            <>
              <label>
                Audience{' '}
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  {[
                    'wholeSchool',
                    'students',
                    'guardians',
                    'staff',
                    'class',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              {scope === 'class' && (
                <label>
                  Class{' '}
                  <select
                    value={schoolClassId}
                    onChange={(event) => setSchoolClassId(event.target.value)}
                  >
                    <option value="">Choose class</option>
                    {structure?.classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.gradeLevelName} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                disabled={busy || (scope === 'class' && !schoolClassId)}
                onClick={() =>
                  void run(
                    () =>
                      setEventAudience(
                        baseUrl,
                        schoolId,
                        selected.id,
                        scope === 'class'
                          ? { scope, schoolClassId }
                          : { scope },
                      ),
                    'Audience saved.',
                  )
                }
              >
                Save audience
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={rsvpEnabled}
                  onChange={(event) => setRsvpEnabled(event.target.checked)}
                />{' '}
                RSVP enabled
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      setEventRsvp(baseUrl, schoolId, selected.id, rsvpEnabled),
                    'RSVP setting saved.',
                  )
                }
              >
                Save RSVP setting
              </button>
              <label>
                Attachment{' '}
                <input
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                disabled={busy || !file}
                onClick={() =>
                  file &&
                  void run(
                    () =>
                      uploadEventAttachment(
                        baseUrl,
                        schoolId,
                        selected.id,
                        file,
                      ),
                    'Attachment uploaded for scanning.',
                  )
                }
              >
                Upload attachment
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !selected.audience ||
                  attachments.some(
                    (attachment) => attachment.status !== 'available',
                  )
                }
                onClick={() =>
                  void run(
                    () =>
                      transitionEvent(
                        baseUrl,
                        schoolId,
                        selected.id,
                        'publish',
                      ),
                    'Event published.',
                  )
                }
              >
                Publish event
              </button>
            </>
          )}
          <ul>
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.originalFileName} —{' '}
                {attachment.status === 'available'
                  ? 'Available'
                  : 'Unavailable pending safe scan'}
              </li>
            ))}
          </ul>
          {selected.status === 'published' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      transitionEvent(
                        baseUrl,
                        schoolId,
                        selected.id,
                        'complete',
                      ),
                    'Event completed.',
                  )
                }
              >
                Complete event
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      transitionEvent(baseUrl, schoolId, selected.id, 'cancel'),
                    'Event cancelled.',
                  )
                }
              >
                Cancel event
              </button>
            </>
          )}
          {counts && (
            <p>
              RSVP: {counts.going} going, {counts.notGoing} not going. RSVP does
              not record attendance.
            </p>
          )}
        </>
      )}
    </section>
  )
}
