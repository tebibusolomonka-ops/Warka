import { useEffect, useState, type FormEvent } from 'react'
import {
  CreateOrganizationSchema,
  CreateSchoolSchema,
  OrganizationSchema,
  type School,
} from '@warka/shared'
import { apiBaseUrl, getSchools, postOrganization, postSchool } from './api'

const storageKey = 'warka.organizationId'

function savedOrganizationId(): string {
  const value = window.localStorage.getItem(storageKey)
  return OrganizationSchema.shape.id.safeParse(value).success ? value! : ''
}

type DirectoryState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'loaded'; schools: School[] }
  | { status: 'error' }

export function SchoolDirectory() {
  const [organizationId, setOrganizationId] = useState(savedOrganizationId)
  const [selectedId, setSelectedId] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [directory, setDirectory] = useState<DirectoryState>({
    status: 'loading',
  })

  useEffect(() => {
    if (!organizationId) return
    let active = true
    setDirectory({ status: 'loading' })

    try {
      const baseUrl = apiBaseUrl(
        import.meta.env.VITE_API_URL,
        window.location.origin,
      )
      getSchools(baseUrl, organizationId)
        .then((schools) => {
          if (active)
            setDirectory(
              schools.length
                ? { status: 'loaded', schools }
                : { status: 'empty' },
            )
        })
        .catch(() => {
          if (active) setDirectory({ status: 'error' })
        })
    } catch {
      setDirectory({ status: 'error' })
    }

    return () => {
      active = false
    }
  }, [organizationId, refresh])

  function selectOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = selectedId.trim()
    if (!OrganizationSchema.shape.id.safeParse(id).success) {
      setFormError('Enter a valid organization ID')
      return
    }
    window.localStorage.setItem(storageKey, id)
    setOrganizationId(id)
    setFormError('')
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = CreateOrganizationSchema.safeParse({
      name: organizationName,
    })
    if (!parsed.success) {
      setFormError('Enter an organization name of 1 to 200 characters')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const baseUrl = apiBaseUrl(
        import.meta.env.VITE_API_URL,
        window.location.origin,
      )
      const organization = await postOrganization(baseUrl, parsed.data.name)
      window.localStorage.setItem(storageKey, organization.id)
      setOrganizationId(organization.id)
      setOrganizationName('')
    } catch {
      setFormError('Could not create organization')
    } finally {
      setBusy(false)
    }
  }

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = CreateSchoolSchema.safeParse({ name: schoolName })
    if (!parsed.success) {
      setFormError('Enter a school name of 1 to 200 characters')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const baseUrl = apiBaseUrl(
        import.meta.env.VITE_API_URL,
        window.location.origin,
      )
      await postSchool(baseUrl, organizationId, parsed.data.name)
      setSchoolName('')
      setRefresh((value) => value + 1)
    } catch {
      setFormError('Could not create school')
    } finally {
      setBusy(false)
    }
  }

  function changeOrganization() {
    window.localStorage.removeItem(storageKey)
    setOrganizationId('')
    setSelectedId('')
    setFormError('')
  }

  return (
    <section aria-labelledby="schools-heading">
      <h2 id="schools-heading">School directory</h2>
      {!organizationId ? (
        <>
          <p>
            Create an organization or enter an existing organization ID to
            manage its schools.
          </p>
          <form onSubmit={selectOrganization}>
            <label htmlFor="organization-id">Organization ID</label>
            <input
              id="organization-id"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              required
            />
            <button type="submit">Open organization</button>
          </form>
          <form onSubmit={createOrganization}>
            <label htmlFor="organization-name">New organization name</label>
            <input
              id="organization-name"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              maxLength={200}
              required
            />
            <button type="submit" disabled={busy}>
              Create organization
            </button>
          </form>
        </>
      ) : (
        <>
          <p>
            Organization ID: <code>{organizationId}</code>
          </p>
          <button type="button" onClick={changeOrganization}>
            Change organization
          </button>
          <form onSubmit={createSchool}>
            <label htmlFor="school-name">School name</label>
            <input
              id="school-name"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              maxLength={200}
              required
            />
            <button type="submit" disabled={busy}>
              Create school
            </button>
          </form>
          {directory.status === 'loading' && (
            <p role="status">Loading schools</p>
          )}
          {directory.status === 'empty' && <p>No schools yet</p>}
          {directory.status === 'error' && (
            <p role="alert">Could not load schools</p>
          )}
          {directory.status === 'loaded' && (
            <ul>
              {directory.schools.map((school) => (
                <li key={school.id}>{school.name}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {formError && <p role="alert">{formError}</p>}
    </section>
  )
}
