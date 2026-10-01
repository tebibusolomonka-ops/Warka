export type PilotSchool = {
  id: string
  name: string
  status: 'planned' | 'preparing' | 'ready' | 'active' | 'paused' | 'completed'
  missing: string[]
  trainingState: string
  dataPreparationState: string
  goLiveWindow?: string
  supportCoverage: string
  history: Array<{ to: string; at: string }>
}

export function PilotReadinessWorkspace({
  schools,
  authorized,
  onTransition,
}: {
  schools: readonly PilotSchool[]
  authorized: boolean
  onTransition: (schoolId: string, status: PilotSchool['status']) => void
}) {
  if (!authorized) return null
  return (
    <section aria-labelledby="pilot-readiness-heading">
      <h2 id="pilot-readiness-heading">Pilot readiness</h2>
      {schools.map((school) => (
        <article key={school.id}>
          <h3>{school.name}</h3>
          <p>State: {school.status}</p>
          <p>Training: {school.trainingState}</p>
          <p>Data preparation: {school.dataPreparationState}</p>
          <p>Support coverage: {school.supportCoverage}</p>
          <p>Planned go-live: {school.goLiveWindow ?? 'Not scheduled'}</p>
          <h4>Missing prerequisites</h4>
          <ul>
            {school.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h4>Transition history</h4>
          <ol>
            {school.history.map((item) => (
              <li key={`${item.to}:${item.at}`}>
                {item.to} at {item.at}
              </li>
            ))}
          </ol>
          {school.status === 'ready' && (
            <button onClick={() => onTransition(school.id, 'active')}>
              Activate pilot
            </button>
          )}
          {school.status === 'active' && (
            <button onClick={() => onTransition(school.id, 'paused')}>
              Pause pilot
            </button>
          )}
        </article>
      ))}
    </section>
  )
}
