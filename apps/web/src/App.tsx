import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  LoginCredentialsSchema,
  type AccessibleSchool,
  type OrganizationAccess,
  type UserIdentity,
  type StudentPortalIdentity,
  type ParentIdentity,
} from '@warka/shared'
import {
  ApiError,
  apiBaseUrl,
  getAccessibleSchools,
  getCurrentUser,
  getStudentIdentity,
  getOrganizations,
  login,
  logout,
} from './api'
import { SchoolDirectory } from './SchoolDirectory'
import { StudentWorkspace } from './StudentWorkspace'
import { AcademicWorkspace } from './AcademicWorkspace'
import { PasswordChange } from './PasswordChange'
import { StudentPortal } from './StudentPortal'
import { ResourceWorkspace } from './ResourceWorkspace'
import { DocumentVerificationPage } from './DocumentVerificationPage'
import { TransferWorkspace } from './TransferWorkspace'
import { ParentPortal } from './ParentPortal'
import { StaffFamilyWorkspace } from './StaffFamilyWorkspace'
import { getParentIdentity } from './parentApi'
import { BureauWorkspace, SchoolReportingWorkspace } from './BureauWorkspace'
import { getBureauAccess, type BureauAccess } from './bureauApi'
import { GovernanceWorkspace } from './GovernanceWorkspace'
import { NotificationCenter } from './NotificationCenter'
import { SchoolOperationsWorkspace } from './SchoolOperationsWorkspace'
import { SchoolDocuments } from './SchoolDocuments'

type Authentication =
  | { status: 'checking' }
  | { status: 'signedOut'; message?: string; retryLogout?: boolean }
  | { status: 'signedIn'; user: UserIdentity }

type Organizations =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; access: OrganizationAccess[] }

type Portal =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'loaded'; identity: StudentPortalIdentity }

type Parent =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'loaded'; identity: ParentIdentity }

type Bureau =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'loaded'; access: BureauAccess[] }

type Schools =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; access: AccessibleSchool[] }

function isExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

function SignedInShell({
  baseUrl,
  user,
  onSignedOut,
  onSignOut,
}: {
  baseUrl: string
  user: UserIdentity
  onSignedOut: (message?: string) => void
  onSignOut: () => void
}) {
  const [organizations, setOrganizations] = useState<Organizations>({
    status: 'loading',
  })
  const [selectedId, setSelectedId] = useState('')
  const [schools, setSchools] = useState<Schools>({ status: 'loading' })
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [operationsRefresh, setOperationsRefresh] = useState(0)
  const [portal, setPortal] = useState<Portal>({ status: 'loading' })
  const [parent, setParent] = useState<Parent>({ status: 'loading' })
  const [bureau, setBureau] = useState<Bureau>({ status: 'loading' })
  const [workspace, setWorkspace] = useState<
    'staff' | 'student' | 'parent' | 'bureau'
  >('staff')

  useEffect(() => {
    let active = true
    setPortal({ status: 'loading' })
    getStudentIdentity(baseUrl)
      .then((identity) => {
        if (active) setPortal({ status: 'loaded', identity })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (isExpired(error))
          onSignedOut('Your session expired. Sign in again.')
        else if (error instanceof ApiError && [403, 404].includes(error.status))
          setPortal({ status: 'none' })
        else setPortal({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSignedOut])

  useEffect(() => {
    let active = true
    setParent({ status: 'loading' })
    getParentIdentity(baseUrl)
      .then((identity) => {
        if (active) setParent({ status: 'loaded', identity })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (isExpired(error))
          onSignedOut('Your session expired. Sign in again.')
        else if (error instanceof ApiError && [403, 404].includes(error.status))
          setParent({ status: 'none' })
        else setParent({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSignedOut])

  useEffect(() => {
    let active = true
    setBureau({ status: 'loading' })
    getBureauAccess(baseUrl)
      .then((access) => {
        if (active)
          setBureau(
            access.length ? { status: 'loaded', access } : { status: 'none' },
          )
      })
      .catch((error: unknown) => {
        if (!active) return
        if (isExpired(error))
          onSignedOut('Your session expired. Sign in again.')
        else setBureau({ status: 'none' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSignedOut])
  useEffect(() => {
    let active = true
    setOrganizations({ status: 'loading' })
    getOrganizations(baseUrl)
      .then((access) => {
        if (active) {
          setOrganizations({ status: 'loaded', access })
          setSelectedId((current) =>
            access.some((item) => item.organization.id === current)
              ? current
              : (access[0]?.organization.id ?? ''),
          )
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        if (isExpired(error))
          onSignedOut('Your session expired. Sign in again.')
        else setOrganizations({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSignedOut])

  useEffect(() => {
    let active = true
    setSchools({ status: 'loading' })
    getAccessibleSchools(baseUrl)
      .then((access) => {
        if (!active) return
        setSchools({ status: 'loaded', access })
        setSelectedSchoolId((current) =>
          access.some((item) => item.school.id === current)
            ? current
            : (access[0]?.school.id ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        if (isExpired(error))
          onSignedOut('Your session expired. Sign in again.')
        else setSchools({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSignedOut])
  const sessionExpired = useCallback(() => {
    onSignedOut('Your session expired. Sign in again.')
  }, [onSignedOut])

  const selected =
    organizations.status === 'loaded'
      ? organizations.access.find((item) => item.organization.id === selectedId)
      : undefined
  const selectedSchool =
    schools.status === 'loaded'
      ? schools.access.find((item) => item.school.id === selectedSchoolId)
      : undefined
  const canManage =
    selected?.role === 'owner' || selected?.role === 'administrator'

  const hasStaffAccess =
    (schools.status === 'loaded' && schools.access.length > 0) ||
    (organizations.status === 'loaded' && organizations.access.length > 0)

  if (
    portal.status === 'loading' ||
    parent.status === 'loading' ||
    bureau.status === 'loading' ||
    schools.status === 'loading' ||
    organizations.status === 'loading'
  )
    return <p role="status">Loading workspaces</p>
  const hasStudentAccess = portal.status === 'loaded'
  const hasParentAccess = parent.status === 'loaded'
  const hasBureauAccess = bureau.status === 'loaded' && bureau.access.length > 0
  const workspaceCount =
    Number(hasStaffAccess) +
    Number(hasStudentAccess) +
    Number(hasParentAccess) +
    Number(hasBureauAccess)
  const activeWorkspace =
    workspace === 'staff' && hasStaffAccess
      ? 'staff'
      : workspace === 'student' && hasStudentAccess
        ? 'student'
        : workspace === 'parent' && hasParentAccess
          ? 'parent'
          : workspace === 'bureau' && hasBureauAccess
            ? 'bureau'
            : hasStaffAccess
              ? 'staff'
              : hasBureauAccess
                ? 'bureau'
                : hasParentAccess
                  ? 'parent'
                  : 'student'
  const workspaceChoices =
    workspaceCount > 1 ? (
      <nav aria-label="Workspace choice" className="workspace-nav">
        {hasStaffAccess && (
          <button
            type="button"
            aria-current={activeWorkspace === 'staff' ? 'page' : undefined}
            onClick={() => setWorkspace('staff')}
          >
            Staff workspace
          </button>
        )}
        {hasStudentAccess && (
          <button
            type="button"
            aria-current={activeWorkspace === 'student' ? 'page' : undefined}
            onClick={() => setWorkspace('student')}
          >
            Student portal
          </button>
        )}
        {hasBureauAccess && (
          <button
            type="button"
            aria-current={activeWorkspace === 'bureau' ? 'page' : undefined}
            onClick={() => setWorkspace('bureau')}
          >
            Bureau workspace
          </button>
        )}
        {hasParentAccess && (
          <button
            type="button"
            aria-current={activeWorkspace === 'parent' ? 'page' : undefined}
            onClick={() => setWorkspace('parent')}
          >
            Parent workspace
          </button>
        )}
      </nav>
    ) : null
  if (activeWorkspace === 'bureau' && bureau.status === 'loaded')
    return (
      <>
        {workspaceChoices}
        <BureauWorkspace baseUrl={baseUrl} access={bureau.access[0]!} />
      </>
    )
  if (activeWorkspace === 'parent' && parent.status === 'loaded')
    return (
      <>
        {workspaceChoices}
        <ParentPortal
          baseUrl={baseUrl}
          identity={parent.identity}
          onSessionExpired={sessionExpired}
          onSignOut={onSignOut}
        />
      </>
    )
  if (activeWorkspace === 'student' && portal.status === 'loaded')
    return (
      <>
        {workspaceChoices}
        <StudentPortal
          baseUrl={baseUrl}
          identity={portal.identity}
          onSessionExpired={sessionExpired}
          onSignOut={onSignOut}
        />
      </>
    )
  if (
    !hasStaffAccess &&
    (portal.status === 'error' || parent.status === 'error')
  )
    return (
      <div role="alert">
        <p>Could not load workspace access.</p>
        <button type="button" onClick={() => setRefresh((value) => value + 1)}>
          Retry
        </button>
      </div>
    )

  return (
    <>
      {workspaceChoices}
      <div className="account">
        <p>Signed in as {user.displayName}</p>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <section aria-labelledby="accessible-schools-heading">
        <h2 id="accessible-schools-heading">My schools</h2>
        {schools.status === 'error' && (
          <div role="alert">
            <p>Could not load accessible schools.</p>
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {schools.status === 'loaded' && schools.access.length === 0 && (
          <p>No schools available for this account.</p>
        )}
        {schools.status === 'loaded' && schools.access.length > 0 && (
          <>
            <div className="field">
              <label htmlFor="accessible-school">School</label>
              <select
                id="accessible-school"
                value={selectedSchoolId}
                onChange={(event) => setSelectedSchoolId(event.target.value)}
              >
                {schools.access.map((item) => (
                  <option key={item.school.id} value={item.school.id}>
                    {item.school.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedSchool &&
              (selectedSchool.capabilities.canApprove ||
                !selectedSchool.capabilities.canRegister) && (
                <>
                  <AcademicWorkspace
                    key={selectedSchool.school.id}
                    baseUrl={baseUrl}
                    schoolId={selectedSchool.school.id}
                    schoolName={selectedSchool.school.name}
                    onSessionExpired={sessionExpired}
                  />
                  <ResourceWorkspace
                    baseUrl={baseUrl}
                    schoolId={selectedSchool.school.id}
                    onSessionExpired={sessionExpired}
                  />
                </>
              )}
            {selectedSchool &&
              (selectedSchool.capabilities.canRegister ||
                !selectedSchool.capabilities.canApprove) && (
                <StaffFamilyWorkspace
                  baseUrl={baseUrl}
                  schoolId={selectedSchool.school.id}
                  canManageSetting={
                    selectedSchool.capabilities.canRegister &&
                    selectedSchool.capabilities.canApprove
                  }
                  onSessionExpired={sessionExpired}
                />
              )}
            {selectedSchool &&
              (selectedSchool.capabilities.canRegister ||
                selectedSchool.capabilities.canApprove) && (
                <SchoolDocuments
                  baseUrl={baseUrl}
                  schoolId={selectedSchool.school.id}
                  canRegister={selectedSchool.capabilities.canRegister}
                  canApprove={selectedSchool.capabilities.canApprove}
                  onSessionExpired={sessionExpired}
                />
              )}
            {selectedSchool && selectedSchool.capabilities.canRegister && (
              <SchoolOperationsWorkspace
                baseUrl={baseUrl}
                schoolId={selectedSchool.school.id}
                onApplied={() => setOperationsRefresh((value) => value + 1)}
                onSessionExpired={sessionExpired}
              />
            )}
            {selectedSchool && selectedSchool.capabilities.canRegister && (
              <SchoolReportingWorkspace
                baseUrl={baseUrl}
                schoolId={selectedSchool.school.id}
              />
            )}{' '}
            {selectedSchool &&
              (selectedSchool.capabilities.canRegister ||
                selectedSchool.capabilities.canApprove) && (
                <TransferWorkspace
                  key={'transfers-' + selectedSchool.school.id}
                  baseUrl={baseUrl}
                  schoolId={selectedSchool.school.id}
                  schoolName={selectedSchool.school.name}
                  onSessionExpired={sessionExpired}
                />
              )}
            {selectedSchool &&
              (selectedSchool.capabilities.canRegister ||
                selectedSchool.capabilities.canApprove) && (
                <StudentWorkspace
                  key={selectedSchool.school.id + '-' + operationsRefresh}
                  baseUrl={baseUrl}
                  access={selectedSchool}
                  onSessionExpired={sessionExpired}
                />
              )}
          </>
        )}
      </section>
      {organizations.status === 'error' && (
        <div role="alert">
          <p>Could not load organizations.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {organizations.status === 'loaded' &&
        organizations.access.length === 0 &&
        schools.status === 'loaded' &&
        schools.access.length === 0 && (
          <p>No organizations available for this account.</p>
        )}
      {organizations.status === 'loaded' && organizations.access.length > 0 && (
        <>
          {organizations.access.length > 1 ? (
            <div className="field">
              <label htmlFor="organization">Organization</label>
              <select
                id="organization"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {organizations.access.map((item) => (
                  <option
                    key={item.organization.id}
                    value={item.organization.id}
                  >
                    {item.organization.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <h2>{selected?.organization.name}</h2>
          )}
          {selected && canManage && (
            <>
              <nav aria-label="Staff administration">
                <a href="#governance-heading">Governance</a>
              </nav>
              <SchoolDirectory
                key={selected.organization.id}
                baseUrl={baseUrl}
                organizationId={selected.organization.id}
                canCreate={canManage}
                onSessionExpired={sessionExpired}
                onCreated={() => setRefresh((value) => value + 1)}
              />
              <GovernanceWorkspace
                baseUrl={baseUrl}
                organizationId={selected.organization.id}
                {...(selectedSchool
                  ? { schoolId: selectedSchool.school.id }
                  : {})}
              />
            </>
          )}
        </>
      )}
    </>
  )
}

function AuthenticatedApp() {
  const [authentication, setAuthentication] = useState<Authentication>({
    status: 'checking',
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const baseUrl = (() => {
    try {
      return apiBaseUrl(import.meta.env.VITE_API_URL, window.location.origin)
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (!baseUrl) {
      setAuthentication({
        status: 'signedOut',
        message: 'The application is not configured to connect to the API.',
      })
      return
    }
    let active = true
    getCurrentUser(baseUrl)
      .then((user) => {
        if (active) setAuthentication({ status: 'signedIn', user })
      })
      .catch((error: unknown) => {
        if (!active) return
        setAuthentication(
          isExpired(error)
            ? { status: 'signedOut' }
            : {
                status: 'signedOut',
                message: 'Could not reach the service. Please try again.',
              },
        )
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!baseUrl) return
    const parsed = LoginCredentialsSchema.safeParse({ email, password })
    if (!parsed.success) {
      setFormError('Enter a valid email and password.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      await login(baseUrl, parsed.data.email, parsed.data.password)
      const user = await getCurrentUser(baseUrl)
      setPassword('')
      setAuthentication({ status: 'signedIn', user })
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.code === 'INVALID_CREDENTIALS'
          ? 'Invalid email or password.'
          : 'Could not sign in. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const signedOut = useCallback((message?: string) => {
    setPassword('')
    setAuthentication(
      message ? { status: 'signedOut', message } : { status: 'signedOut' },
    )
  }, [])

  const signOut = useCallback(async () => {
    if (!baseUrl) return
    setPassword('')
    setAuthentication({ status: 'signedOut' })
    setSigningOut(true)
    try {
      await logout(baseUrl)
    } catch {
      setAuthentication({
        status: 'signedOut',
        message: 'Could not confirm sign out. Please try again.',
        retryLogout: true,
      })
    } finally {
      setSigningOut(false)
    }
  }, [baseUrl])

  return (
    <main className="shell">
      <header>
        <h1>Warka</h1>
        <p>School records and services</p>
      </header>
      {authentication.status === 'checking' && (
        <p role="status">Checking authentication</p>
      )}
      {authentication.status === 'signedOut' && (
        <section aria-labelledby="signin-heading">
          <h2 id="signin-heading">Sign in</h2>
          {authentication.message && (
            <div role="alert">
              <p>{authentication.message}</p>
              {baseUrl && (
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => {
                    if (authentication.retryLogout) {
                      void signOut()
                    } else {
                      setAuthentication({ status: 'checking' })
                      setRefresh((value) => value + 1)
                    }
                  }}
                >
                  {authentication.retryLogout ? 'Retry sign out' : 'Retry'}
                </button>
              )}
            </div>
          )}
          <form onSubmit={signIn}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={busy || signingOut || !baseUrl}>
              {busy ? 'Signing in' : 'Sign in'}
            </button>
          </form>
          {formError && <p role="alert">{formError}</p>}
        </section>
      )}
      {authentication.status === 'signedIn' &&
        baseUrl &&
        authentication.user.mustChangePassword && (
          <PasswordChange
            baseUrl={baseUrl}
            onSignOut={() => void signOut()}
            onChanged={async () => {
              const user = await getCurrentUser(baseUrl)
              setAuthentication({ status: 'signedIn', user })
            }}
          />
        )}
      {authentication.status === 'signedIn' &&
        baseUrl &&
        !authentication.user.mustChangePassword && (
          <>
            <NotificationCenter baseUrl={baseUrl} />
            <SignedInShell
              baseUrl={baseUrl}
              user={authentication.user}
              onSignedOut={signedOut}
              onSignOut={() => void signOut()}
            />
          </>
        )}
    </main>
  )
}

export function App() {
  const path = window.location.pathname
  if (path === '/verify' || path === '/verify/')
    return <DocumentVerificationPage />
  if (path.startsWith('/verify/'))
    return (
      <DocumentVerificationPage
        initialReference={path.slice('/verify/'.length)}
      />
    )
  return <AuthenticatedApp />
}
