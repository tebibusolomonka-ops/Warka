import { useEffect, useState } from 'react'
import type { StudentPortalIdentity, StudentResult } from '@warka/shared'
import { ApiError, getStudentResults } from './api'

type ResultState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentResult[] }
type Section = 'Overview' | 'Results' | 'Materials' | 'Announcements'

export function StudentPortal({
  baseUrl,
  identity,
  onSessionExpired,
  onSignOut,
}: {
  baseUrl: string
  identity: StudentPortalIdentity
  onSessionExpired: () => void
  onSignOut: () => void
}) {
  const [section, setSection] = useState<Section>('Overview')
  const [results, setResults] = useState<ResultState>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (section !== 'Results') return
    let active = true
    setResults({ status: 'loading' })
    getStudentResults(baseUrl)
      .then((data) => {
        if (active) setResults({ status: 'loaded', data })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired()
        else setResults({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, section, refresh, onSessionExpired])

  const grouped = new Map<string, StudentResult[]>()
  if (results.status === 'loaded')
    for (const result of results.data) {
      const key = result.academicYear + ' � ' + result.gradingPeriod
      grouped.set(key, [...(grouped.get(key) ?? []), result])
    }
  const name = [identity.givenName, identity.familyName]
    .filter(Boolean)
    .join(' ')
  return (
    <section
      aria-labelledby="student-portal-heading"
      className="student-portal"
    >
      <div className="account">
        <h2 id="student-portal-heading">Student portal</h2>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <nav aria-label="Student portal" className="workspace-nav">
        {(['Overview', 'Results', 'Materials', 'Announcements'] as const).map(
          (item) => (
            <button
              key={item}
              type="button"
              aria-current={section === item ? 'page' : undefined}
              onClick={() => setSection(item)}
            >
              {item}
            </button>
          ),
        )}
      </nav>
      {section === 'Overview' && (
        <div className="academic-panel">
          <h3>{name}</h3>
          <p>Student reference: {identity.studentReference}</p>
          {identity.currentEnrollment ? (
            <dl>
              <dt>School</dt>
              <dd>{identity.currentEnrollment.school}</dd>
              <dt>Academic year</dt>
              <dd>{identity.currentEnrollment.academicYear}</dd>
              <dt>Grade</dt>
              <dd>{identity.currentEnrollment.gradeLevel}</dd>
              {identity.currentEnrollment.schoolClass && (
                <>
                  <dt>Class</dt>
                  <dd>{identity.currentEnrollment.schoolClass}</dd>
                </>
              )}
            </dl>
          ) : (
            <p>No current approved enrollment.</p>
          )}
        </div>
      )}
      {section === 'Results' && (
        <div className="academic-panel">
          <h3>Published results</h3>
          {results.status === 'loading' && <p role="status">Loading results</p>}
          {results.status === 'error' && (
            <div role="alert">
              <p>Could not load results.</p>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {results.status === 'loaded' && results.data.length === 0 && (
            <p>No published results yet.</p>
          )}
          {[...grouped].map(([period, rows]) => (
            <section key={period}>
              <h4>{period}</h4>
              <ul>
                {rows.map((row) => (
                  <li key={row.subject + row.publishedAt}>
                    {row.subject}: {row.percentage}% � {row.gradeLabel}
                    {row.corrected && <span> � Corrected</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {section === 'Materials' && (
        <div className="academic-panel">
          <h3>Materials</h3>
          <p>Learning materials will appear here.</p>
        </div>
      )}
      {section === 'Announcements' && (
        <div className="academic-panel">
          <h3>Announcements</h3>
          <p>School announcements will appear here.</p>
        </div>
      )}
    </section>
  )
}
