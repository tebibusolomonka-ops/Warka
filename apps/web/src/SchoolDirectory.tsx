import { useEffect, useState, type FormEvent } from 'react'
import { CreateSchoolSchema, type School } from '@warka/shared'
import { ApiError, getSchools, postSchool } from './api'

type DirectoryState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'loaded'; schools: School[] }
  | { status: 'error' }

export function SchoolDirectory({
  baseUrl,
  organizationId,
  canCreate,
  onSessionExpired,
  onCreated,
}: {
  baseUrl: string
  organizationId: string
  canCreate: boolean
  onSessionExpired: () => void
  onCreated?: () => void
}) {
  const [schoolName, setSchoolName] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [directory, setDirectory] = useState<DirectoryState>({
    status: 'loading',
  })

  useEffect(() => {
    let active = true
    setDirectory({ status: 'loading' })
    getSchools(baseUrl, organizationId)
      .then((schools) => {
        if (active)
          setDirectory(
            schools.length
              ? { status: 'loaded', schools }
              : { status: 'empty' },
          )
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401) {
          onSessionExpired()
        } else {
          setDirectory({ status: 'error' })
        }
      })
    return () => {
      active = false
    }
  }, [baseUrl, organizationId, refresh, onSessionExpired])

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) return
    const parsed = CreateSchoolSchema.safeParse({ name: schoolName })
    if (!parsed.success) {
      setFormError('Enter a school name of 1 to 200 characters.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      await postSchool(baseUrl, organizationId, parsed.data.name)
      setSchoolName('')
      onCreated?.()
      setRefresh((value) => value + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onSessionExpired()
      } else {
        setFormError('Could not create school.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="schools-heading">
      <h2 id="schools-heading">School directory</h2>
      {canCreate && (
        <form onSubmit={createSchool}>
          <div className="field">
            <label htmlFor="school-name">School name</label>
            <input
              id="school-name"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            Create school
          </button>
        </form>
      )}
      {directory.status === 'loading' && <p role="status">Loading schools</p>}
      {directory.status === 'empty' && <p>No schools yet.</p>}
      {directory.status === 'error' && (
        <div role="alert">
          <p>Could not load schools.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {directory.status === 'loaded' && (
        <ul>
          {directory.schools.map((school) => (
            <li key={school.id}>{school.name}</li>
          ))}
        </ul>
      )}
      {formError && <p role="alert">{formError}</p>}
    </section>
  )
}
