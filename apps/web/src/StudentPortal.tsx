import { useEffect, useState } from 'react'
import { StudentDocuments } from './StudentDocuments'
import { AcademicProgressSummary } from './AcademicProgressSummary'
import { AttendanceHistoryView } from './AttendanceHistoryView'
import { StudentCourseworkWorkspace } from './StudentCourseworkWorkspace'
import { FamilyEventWorkspace } from './FamilyEventWorkspace'
import { getOwnStudentAttendance } from './attendanceApi'
import {
  createTranslator,
  formatPercentage,
  safeExternalUrl,
  type StudentPortalIdentity,
  type StudentResult,
  type StudentMaterial,
  type StudentAnnouncement,
} from '@warka/shared'
import { browserLocale } from './LocalizedNavigation'
import {
  ApiError,
  getStudentResults,
  getStudentMaterials,
  getStudentAnnouncements,
} from './api'

type ResultState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: StudentResult[] }
type LoadState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: T }
type Section =
  | 'Overview'
  | 'Results'
  | 'Materials'
  | 'Announcements'
  | 'Documents'
  | 'Attendance'
  | 'Coursework'
  | 'Events'

export function StudentPortal({
  baseUrl,
  identity,
  onSessionExpired,
  onSignOut,
  locale,
  calendar,
}: {
  baseUrl: string
  identity: StudentPortalIdentity
  onSessionExpired: () => void
  onSignOut: () => void
  locale?: string | undefined
  calendar?: 'gregorian' | 'ethiopian' | undefined
}) {
  const t = createTranslator({ locale: locale ?? browserLocale() })
  const sectionLabel: Record<Section, string> = {
    Overview: t('portal.overview'),
    Results: t('portal.results'),
    Materials: t('portal.materials'),
    Announcements: t('portal.announcements'),
    Documents: t('portal.documents'),
    Attendance: t('portal.attendance'),
    Coursework: t('portal.coursework'),
    Events: t('portal.events'),
  }
  const [section, setSection] = useState<Section>('Overview')
  const [results, setResults] = useState<ResultState>({ status: 'loading' })
  const [materials, setMaterials] = useState<LoadState<StudentMaterial[]>>({
    status: 'loading',
  })
  const [announcements, setAnnouncements] = useState<
    LoadState<StudentAnnouncement[]>
  >({ status: 'loading' })
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

  useEffect(() => {
    if (section !== 'Materials') return
    let active = true
    setMaterials({ status: 'loading' })
    getStudentMaterials(baseUrl)
      .then((data) => {
        if (active) setMaterials({ status: 'loaded', data })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired()
        else setMaterials({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, section, refresh, onSessionExpired])

  useEffect(() => {
    if (section !== 'Announcements') return
    let active = true
    setAnnouncements({ status: 'loading' })
    getStudentAnnouncements(baseUrl)
      .then((data) => {
        if (active) setAnnouncements({ status: 'loaded', data })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired()
        else setAnnouncements({ status: 'error' })
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
  const groupedMaterials = new Map<string, StudentMaterial[]>()
  if (materials.status === 'loaded')
    for (const material of materials.data) {
      const key = material.academicYear + ' - ' + material.subject
      groupedMaterials.set(key, [
        ...(groupedMaterials.get(key) ?? []),
        material,
      ])
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
        <h2 id="student-portal-heading">{t('portal.student')}</h2>
        <button type="button" onClick={onSignOut}>
          {t('navigation.signOut')}
        </button>
      </div>
      <nav aria-label={t('portal.student')} className="workspace-nav">
        {(
          [
            'Overview',
            'Results',
            'Materials',
            'Announcements',
            'Documents',
            'Attendance',
            'Coursework',
            'Events',
          ] as const
        ).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={section === item ? 'page' : undefined}
            onClick={() => setSection(item)}
          >
            {sectionLabel[item]}
          </button>
        ))}
      </nav>
      {section === 'Documents' && (
        <StudentDocuments
          baseUrl={baseUrl}
          onSessionExpired={onSessionExpired}
        />
      )}
      {section === 'Attendance' && (
        <AttendanceHistoryView
          requestKey={baseUrl}
          load={() => getOwnStudentAttendance(baseUrl)}
        />
      )}
      {section === 'Coursework' && (
        <StudentCourseworkWorkspace
          baseUrl={baseUrl}
          onSessionExpired={onSessionExpired}
        />
      )}
      {section === 'Events' && identity.currentEnrollment?.schoolId && (
        <FamilyEventWorkspace
          baseUrl={baseUrl}
          schoolId={identity.currentEnrollment.schoolId}
          locale={locale}
          calendar={calendar}
        />
      )}
      {section === 'Overview' && (
        <div className="academic-panel">
          <h3>{name}</h3>
          <p>Student reference: {identity.studentReference}</p>
          {identity.currentEnrollment ? (
            <dl>
              <dt>{t('portal.school')}</dt>
              <dd>{identity.currentEnrollment.school}</dd>
              <dt>{t('portal.academicYear')}</dt>
              <dd>{identity.currentEnrollment.academicYear}</dd>
              <dt>{t('portal.grade')}</dt>
              <dd>{identity.currentEnrollment.gradeLevel}</dd>
              {identity.currentEnrollment.schoolClass && (
                <>
                  <dt>{t('portal.class')}</dt>
                  <dd>{identity.currentEnrollment.schoolClass}</dd>
                </>
              )}
            </dl>
          ) : (
            <p>No current approved enrollment.</p>
          )}
          <AcademicProgressSummary baseUrl={baseUrl} path="/student/progress" />
        </div>
      )}
      {section === 'Results' && (
        <div className="academic-panel">
          <h3>{t('portal.publishedResults')}</h3>
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
                    {row.subject}: {formatPercentage(row.percentage, locale)} ·{' '}
                    {row.gradeLabel}
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
          <h3>{t('portal.materials')}</h3>
          {materials.status === 'loading' && (
            <p role="status">Loading materials</p>
          )}
          {materials.status === 'error' && (
            <div role="alert">
              <p>Could not load materials.</p>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {materials.status === 'loaded' && materials.data.length === 0 && (
            <p>No learning materials yet.</p>
          )}
          {[...groupedMaterials].map(([group, items]) => (
            <section key={group}>
              <h4>{group}</h4>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    {item.description && <p>{item.description}</p>}
                    {item.resourceType === 'file' ? (
                      <a
                        href={`${baseUrl}/schools/${item.schoolId}/materials/${item.id}/download`}
                        download
                      >
                        Download file
                      </a>
                    ) : (
                      safeExternalUrl(item.resourceLocation) && (
                        <a
                          href={item.resourceLocation}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open resource
                        </a>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {section === 'Announcements' && (
        <div className="academic-panel">
          <h3>{t('portal.announcements')}</h3>
          {announcements.status === 'loading' && (
            <p role="status">Loading announcements</p>
          )}
          {announcements.status === 'error' && (
            <div role="alert">
              <p>Could not load announcements.</p>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {announcements.status === 'loaded' &&
            announcements.data.length === 0 && <p>No active announcements.</p>}
          {announcements.status === 'loaded' && (
            <ul>
              {announcements.data.map((item) => (
                <li key={item.id}>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                  <p>
                    {item.scope.type === 'class'
                      ? item.scope.name
                      : 'School-wide'}{' '}
                    - {item.publishedAt.slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
