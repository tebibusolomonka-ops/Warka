import { useEffect, useState } from 'react'
import { requestJson } from './api'

export type AcademicProgress = {
  completedAssessments: number
  publishedResultsAvailable: number
  subjectsWithPublishedResults: string[]
  upcomingAssessments: {
    id: string
    name: string
    subject: string
    date: string
    startTime: string
    endTime: string
  }[]
}

export function AcademicProgressSummary({
  baseUrl,
  path,
}: {
  baseUrl: string
  path: string
}) {
  const [progress, setProgress] = useState<AcademicProgress | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setProgress(null)
    setError(false)
    requestJson(baseUrl, path)
      .then((value) => active && setProgress(value as AcademicProgress))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [baseUrl, path])
  return (
    <section aria-label="Academic progress summary">
      <h4>Academic progress</h4>
      {error && <p>Progress summary is unavailable.</p>}
      {!error && !progress && <p>Loading progress summary</p>}
      {progress && (
        <>
          <p>
            Completed assessments: {progress.completedAssessments}. Published
            results available: {progress.publishedResultsAvailable}.
          </p>
          <p>
            Subjects with published results:{' '}
            {progress.subjectsWithPublishedResults.join(', ') || 'None yet'}.
          </p>
          <h5>Upcoming assessments</h5>
          {progress.upcomingAssessments.length === 0 ? (
            <p>No upcoming scheduled assessments.</p>
          ) : (
            <ul>
              {progress.upcomingAssessments.map((item) => (
                <li key={item.id}>
                  {item.name} · {item.subject} · {item.date} {item.startTime}–
                  {item.endTime}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
