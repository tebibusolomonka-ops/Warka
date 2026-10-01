import { useState } from 'react'

export type ResponseAlert = {
  id: string
  policy: string
  severity: 'warning' | 'critical'
  state: 'open' | 'acknowledged' | 'resolved'
  occurrenceCount: number
}
export type ResponseIncident = {
  id: string
  summary: string
  severity: string
  status: string
  alertIds: string[]
}

export function OperationsResponseWorkspace({
  authorized,
  alerts,
  incidents,
  onAcknowledge,
  onDeclareIncident,
}: {
  authorized: boolean
  alerts: readonly ResponseAlert[]
  incidents: readonly ResponseIncident[]
  onAcknowledge: (id: string) => Promise<void>
  onDeclareIncident: (alertId: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string>()
  if (!authorized) return null
  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    try {
      await action()
    } finally {
      setBusy(undefined)
    }
  }
  return (
    <section aria-labelledby="operations-response-heading">
      <h2 id="operations-response-heading">Operations response</h2>
      <h3>Operational alerts</h3>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id}>
            <strong>{alert.policy}</strong> {alert.severity} {alert.state};
            detected {alert.occurrenceCount} times
            {alert.state === 'open' && (
              <>
                <button
                  disabled={busy === alert.id}
                  onClick={() => run(alert.id, () => onAcknowledge(alert.id))}
                >
                  Acknowledge alert
                </button>
                <button
                  disabled={busy === alert.id}
                  onClick={() =>
                    run(alert.id, () => onDeclareIncident(alert.id))
                  }
                >
                  Declare incident
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <h3>Incident response</h3>
      <ul>
        {incidents.map((incident) => (
          <li key={incident.id}>
            {incident.severity} {incident.status}: {incident.summary}
          </li>
        ))}
      </ul>
      <p>
        Maintenance can suppress configured notifications while health evidence
        remains visible.
      </p>
    </section>
  )
}
