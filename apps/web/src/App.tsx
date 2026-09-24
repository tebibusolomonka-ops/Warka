import { useEffect, useState } from 'react'
import { apiBaseUrl, getHealth } from './api'
import { SchoolDirectory } from './SchoolDirectory'

type ServiceStatus = 'checking' | 'available' | 'unavailable'

export function App() {
  const [status, setStatus] = useState<ServiceStatus>('checking')

  useEffect(() => {
    let active = true

    try {
      const baseUrl = apiBaseUrl(
        import.meta.env.VITE_API_URL,
        window.location.origin,
      )
      getHealth(baseUrl)
        .then(() => {
          if (active) setStatus('available')
        })
        .catch(() => {
          if (active) setStatus('unavailable')
        })
    } catch {
      setStatus('unavailable')
    }

    return () => {
      active = false
    }
  }, [])

  const message = {
    checking: 'Checking service',
    available: 'Service available',
    unavailable: 'Service unavailable',
  }[status]

  return (
    <main className="shell">
      <header>
        <h1>Warka</h1>
        <p>School records and services</p>
        <p role="status">{message}</p>
      </header>
      <SchoolDirectory />
    </main>
  )
}
