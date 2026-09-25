import { useEffect, useState, type FormEvent } from 'react'
import {
  getAcademicStructure,
  getTeachingAssignments,
  type AcademicStructure,
  type TeachingAssignment,
} from './academicApi'
import { ApiError } from './api'
import { postAnnouncement, postLearningMaterial } from './resourceApi'

type Data = { structure: AcademicStructure; assignments: TeachingAssignment[] }
type Load =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: Data }

export function ResourceWorkspace({
  baseUrl,
  schoolId,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  onSessionExpired: () => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [assignmentId, setAssignmentId] = useState('')
  const [materialTitle, setMaterialTitle] = useState('')
  const [description, setDescription] = useState('')
  const [resourceLocation, setResourceLocation] = useState('')
  const [announcementClassId, setAnnouncementClassId] = useState('')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [body, setBody] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    Promise.all([
      getAcademicStructure(baseUrl, schoolId),
      getTeachingAssignments(baseUrl, schoolId),
    ])
      .then(([structure, assignments]) => {
        if (active)
          setLoad({ status: 'loaded', data: { structure, assignments } })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setLoad({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, refresh, onSessionExpired])

  const data = load.status === 'loaded' ? load.data : null
  const role = data?.structure.role
  if (role === 'approver') return null
  const assignments = role === 'teacher' ? (data?.assignments ?? []) : []
  const assignment =
    assignments.find((item) => item.id === assignmentId) ?? assignments[0]
  const classes =
    role === 'teacher'
      ? (data?.structure.classes.filter((item) =>
          assignments.some(
            (assignment) => assignment.schoolClassId === item.id,
          ),
        ) ?? [])
      : (data?.structure.classes ?? [])

  function describeAssignment(item: TeachingAssignment) {
    const year =
      data?.structure.academicYears.find(
        (value) => value.id === item.academicYearId,
      )?.name ?? 'Year'
    const schoolClass =
      data?.structure.classes.find((value) => value.id === item.schoolClassId)
        ?.name ?? 'Class'
    const subject =
      data?.structure.subjects.find((value) => value.id === item.subjectId)
        ?.name ?? 'Subject'
    return year + ' - ' + schoolClass + ' - ' + subject
  }

  async function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!assignment) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await postLearningMaterial(baseUrl, schoolId, {
        academicYearId: assignment.academicYearId,
        schoolClassId: assignment.schoolClassId,
        subjectId: assignment.subjectId,
        title: materialTitle,
        ...(description.trim() ? { description } : {}),
        resourceType: 'link',
        resourceLocation,
        publish: true,
      })
      setMaterialTitle('')
      setDescription('')
      setResourceLocation('')
      setMessage('Material published.')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else setError('Could not publish material.')
    } finally {
      setBusy(false)
    }
  }

  async function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (role === 'teacher' && !announcementClassId && !classes[0]) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const classId =
        announcementClassId || (role === 'teacher' ? classes[0]?.id : '')
      await postAnnouncement(baseUrl, schoolId, {
        ...(classId ? { schoolClassId: classId } : {}),
        title: announcementTitle,
        body,
        publish: true,
      })
      setAnnouncementTitle('')
      setBody('')
      setMessage('Announcement published.')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
      else setError('Could not publish announcement.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="academic-workspace" aria-labelledby="resources-heading">
      <h2 id="resources-heading">Learning and notices</h2>
      {load.status === 'loading' && (
        <p role="status">Loading resource controls</p>
      )}
      {load.status === 'error' && (
        <div role="alert">
          <p>Could not load resource controls.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {role === 'teacher' && (
        <div className="academic-panel">
          <h3>Publish learning material</h3>
          {assignments.length === 0 ? (
            <p>No teaching assignments available.</p>
          ) : (
            <form onSubmit={submitMaterial}>
              <label className="field">
                Class and subject
                <select
                  value={assignment?.id ?? ''}
                  onChange={(event) => setAssignmentId(event.target.value)}
                >
                  {assignments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {describeAssignment(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Title
                <input
                  value={materialTitle}
                  onChange={(event) => setMaterialTitle(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                Description
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="field">
                Resource URL
                <input
                  type="url"
                  value={resourceLocation}
                  onChange={(event) => setResourceLocation(event.target.value)}
                  required
                  pattern="https://.*"
                />
              </label>
              <button type="submit" disabled={busy}>
                Publish material
              </button>
            </form>
          )}
        </div>
      )}
      {(role === 'teacher' || role === 'administrator') && (
        <div className="academic-panel">
          <h3>Publish announcement</h3>
          {role === 'teacher' && classes.length === 0 ? (
            <p>No current assigned classes available.</p>
          ) : (
            <form onSubmit={submitAnnouncement}>
              <label className="field">
                Scope
                <select
                  value={announcementClassId}
                  onChange={(event) =>
                    setAnnouncementClassId(event.target.value)
                  }
                >
                  {role === 'administrator' && (
                    <option value="">School-wide</option>
                  )}
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Title
                <input
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                Message
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={busy}>
                Publish announcement
              </button>
            </form>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
