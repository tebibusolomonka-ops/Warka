import { useEffect, useState } from 'react'
import { getPerformanceSummary, type PerformanceSummary } from './operationsApi'

export function PerformanceWorkspace({ baseUrl }: { baseUrl: string }) {
  const [summary, setSummary] = useState<PerformanceSummary>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void getPerformanceSummary(baseUrl).then(
      (value) => active && setSummary(value),
      () => active && setError('Could not load performance status.'),
    )
    return () => {
      active = false
    }
  }, [baseUrl])
  return (
    <section id="operations-performance" aria-labelledby="performance-heading">
      <h3 id="performance-heading">Performance</h3>
      {error && <p role="alert">{error}</p>}
      <p>Database readiness: {summary?.database.state ?? 'Unknown'}</p>
      <p>
        Database pool limit:{' '}
        {summary?.database.pool.connectionLimit ?? 'Unknown'}
      </p>
      <h4>Request categories</h4>
      <ul>
        {summary?.requestCategories.map((item) => (
          <li key={item.category}>
            {item.category}: {item.requests} requests, {item.exceeded} budget
            warnings, {item.maxDurationMs} ms maximum
          </li>
        ))}
      </ul>
      <h4>Database queries</h4>
      <ul>
        {summary?.databaseQueries.map((item) => (
          <li key={item.category}>
            {item.category}: {item.count} queries, {item.slow} slow,{' '}
            {item.failures} failed
          </li>
        ))}
      </ul>
      <h4>Background queue depth</h4>
      <ul>
        {summary?.queueDepth.map((item) => (
          <li key={item.category}>
            {item.category}: {item.count}
          </li>
        ))}
      </ul>
      <p>Recent load test: {summary?.loadTest ?? 'Not imported'}</p>
    </section>
  )
}
