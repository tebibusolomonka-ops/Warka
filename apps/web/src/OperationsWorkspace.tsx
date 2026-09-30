import { useEffect, useState, type FormEvent } from 'react'
import { formatFileSize } from '@warka/shared'
import { browserLocale } from './LocalizedNavigation'
import { ApiError } from './api'
import { FileSecurityWorkspace } from './FileSecurityWorkspace'
import { EmailDeliveryWorkspace } from './EmailDeliveryWorkspace'
import { RecoveryWorkspace } from './RecoveryWorkspace'
import { PerformanceWorkspace } from './PerformanceWorkspace'
import {
  addIncidentUpdate,
  changeIncidentStatus,
  changeMaintenanceStatus,
  createIncident,
  createMaintenance,
  getIncident,
  getOperationsStatus,
  getDeploymentStatus,
  getSupplyChainStatus,
  getStorageSummary,
  listBackups,
  listIncidents,
  listMaintenance,
  getSchedulerState,
  listScheduledExecutions,
  listDueBackupPolicies,
  retryScheduledExecution,
  rehearseBackup,
  requestBackup,
  verifyBackup,
  type Backup,
  type Incident,
  type IncidentTimeline,
  type Maintenance,
  type OperationsStatus,
  type DeploymentStatus,
  type SupplyChainStatus,
  type SchedulerState,
  type ScheduledExecution,
  type DueBackupPolicy,
  type StorageSummary,
} from './operationsApi'

export function OperationsWorkspace({ baseUrl }: { baseUrl: string }) {
  const [available, setAvailable] = useState(false)
  const [status, setStatus] = useState<OperationsStatus>()
  const [deployment, setDeployment] = useState<DeploymentStatus>()
  const [supplyChain, setSupplyChain] = useState<SupplyChainStatus>()
  const [backups, setBackups] = useState<Backup[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [scheduler, setScheduler] = useState<SchedulerState>()
  const [executions, setExecutions] = useState<ScheduledExecution[]>([])
  const [duePolicies, setDuePolicies] = useState<DueBackupPolicy[]>([])
  const [storage, setStorage] = useState<StorageSummary>()
  const [timeline, setTimeline] = useState<IncidentTimeline>()
  const [incidentTitle, setIncidentTitle] = useState('')
  const [incidentSummary, setIncidentSummary] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [updateMessage, setUpdateMessage] = useState('')
  const [maintenanceTitle, setMaintenanceTitle] = useState('')
  const [maintenanceReason, setMaintenanceReason] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      getOperationsStatus(baseUrl),
      getDeploymentStatus(baseUrl),
      getSupplyChainStatus(baseUrl),
      listBackups(baseUrl),
      listIncidents(baseUrl),
      listMaintenance(baseUrl),
      getSchedulerState(baseUrl),
      listScheduledExecutions(baseUrl),
      listDueBackupPolicies(baseUrl),
      getStorageSummary(baseUrl),
    ])
      .then(
        ([
          nextStatus,
          nextDeployment,
          nextSupplyChain,
          nextBackups,
          nextIncidents,
          nextMaintenance,
          nextScheduler,
          nextExecutions,
          nextDuePolicies,
          nextStorage,
        ]) => {
          if (!active) return
          setAvailable(true)
          setStatus(nextStatus)
          setDeployment(nextDeployment)
          setSupplyChain(nextSupplyChain)
          setBackups(nextBackups)
          setIncidents(nextIncidents)
          setMaintenance(nextMaintenance)
          setScheduler(nextScheduler)
          setExecutions(nextExecutions)
          setDuePolicies(nextDuePolicies)
          setStorage(nextStorage)
        },
      )
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && [401, 403].includes(caught.status))
          setAvailable(false)
        else setError('Could not load operations status.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      setRefresh((value) => value + 1)
    } catch {
      setError('The operations action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function openIncident(id: string) {
    setError('')
    try {
      setTimeline(await getIncident(baseUrl, id))
    } catch {
      setError('Could not load the incident timeline.')
    }
  }

  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(async () => {
      await createIncident(baseUrl, {
        severity,
        title: incidentTitle,
        summary: incidentSummary,
      })
      setIncidentTitle('')
      setIncidentSummary('')
    })
  }

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(async () => {
      await createMaintenance(baseUrl, {
        title: maintenanceTitle,
        reason: maintenanceReason,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      })
      setMaintenanceTitle('')
      setMaintenanceReason('')
    })
  }

  if (!available) return error ? <p role="alert">{error}</p> : null
  return (
    <section aria-label="Operations" id="operations">
      <h2>Operations</h2>
      <nav aria-label="Operations sections">
        <a href="#operations-status">System status</a>{' '}
        <a href="#operations-deployment">Deployment</a>{' '}
        <a href="#operations-supply-chain">Supply chain</a>{' '}
        <a href="#operations-backups">Backups</a>{' '}
        <a href="#operations-rehearsals">Restore rehearsals</a>{' '}
        <a href="#operations-scheduled">Scheduled tasks</a>{' '}
        <a href="#operations-incidents">Incidents</a>{' '}
        <a href="#operations-maintenance">Maintenance</a>{' '}
        <a href="#operations-metrics">Metrics</a>
        <a href="#operations-storage">Storage</a>
        <a href="#operations-file-security">File security</a>
        <a href="#operations-email">Email delivery</a>
        <a href="#operations-recovery">Recovery</a>
        <a href="#operations-performance">Performance</a>
      </nav>
      {error && <p role="alert">{error}</p>}
      <section id="operations-deployment" aria-labelledby="deployment-heading">
        <h3 id="deployment-heading">Deployment</h3>
        <button type="button" onClick={() => setRefresh((value) => value + 1)}>
          Refresh deployment
        </button>
        <p>Application version: {deployment?.build.version ?? 'Unknown'}</p>
        <p>Commit SHA: {deployment?.build.commitSha ?? 'Unavailable'}</p>
        <p>Build timestamp: {deployment?.build.builtAt ?? 'Unavailable'}</p>
        <p>Environment: {deployment?.build.environment ?? 'Unknown'}</p>
        <p>Deployment readiness: {deployment?.readiness.status ?? 'Unknown'}</p>
        <p>Migration status: {deployment?.readiness.migration ?? 'Unknown'}</p>
        <ul>
          {Object.entries(deployment?.readiness.dependencies ?? {}).map(
            ([name, state]) => (
              <li key={name}>
                {name}: {state}
              </li>
            ),
          )}
          {Object.entries(deployment?.features ?? {}).map(([name, enabled]) => (
            <li key={name}>
              {name}: {enabled ? 'enabled' : 'disabled'}
            </li>
          ))}
          {deployment?.readiness.reasons.map((reason) => (
            <li key={reason}>Reason: {reason}</li>
          ))}
        </ul>
      </section>
      <section
        id="operations-supply-chain"
        aria-labelledby="supply-chain-heading"
      >
        <h3 id="supply-chain-heading">Supply chain</h3>
        <p>Build commit: {supplyChain?.buildCommit ?? 'Unavailable'}</p>
        <p>
          Dependency audit: {supplyChain?.dependencyAudit.status ?? 'unknown'}
        </p>
        <p>
          Audit time: {supplyChain?.dependencyAudit.checkedAt ?? 'Unavailable'}
        </p>
        <p>
          SBOM:{' '}
          {supplyChain?.sbom.available
            ? supplyChain.sbom.specification
            : 'Unavailable'}
        </p>
        <p>
          Workflow security policy: version{' '}
          {supplyChain?.workflowPolicyVersion ?? 'unknown'}
        </p>
        <p>
          Dependency metadata warnings:{' '}
          {supplyChain?.dependencyMetadataWarningCount ?? 'Unavailable'}
        </p>
      </section>
      <section id="operations-status">
        <h3>System status</h3>
        <p>Readiness: {status?.readiness.status ?? 'Unknown'}</p>
        <ul>
          {Object.entries(status?.readiness.dependencies ?? {}).map(
            ([name, state]) => (
              <li key={name}>
                {name}: {state}
              </li>
            ),
          )}
        </ul>
        <p>Open incidents: {status?.openIncidents.length ?? 0}</p>
      </section>
      <section id="operations-storage">
        <h3>File storage</h3>
        <p>Available assets: {storage?.availableAssetCount ?? 0}</p>
        <p>Stored bytes: {storage?.storedBytes ?? '0'}</p>
        <p>Quarantined assets: {storage?.quarantinedAssetCount ?? 0}</p>
        <ul>
          {storage?.byPurpose.map((item) => (
            <li key={item.purpose}>
              {item.purpose}: {item.count}
            </li>
          ))}
        </ul>
      </section>
      <p>Scanner: {status?.fileSecurity?.scanner ?? 'unavailable'}</p>
      <FileSecurityWorkspace baseUrl={baseUrl} />
      <EmailDeliveryWorkspace
        baseUrl={baseUrl}
        provider={status?.emailDelivery?.provider ?? 'disabled'}
        counts={status?.emailDelivery?.counts ?? {}}
        retryCount={status?.emailDelivery?.retryCount ?? 0}
      />
      <RecoveryWorkspace baseUrl={baseUrl} />
      <PerformanceWorkspace baseUrl={baseUrl} />
      <section id="operations-backups">
        <h3>Backups</h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => requestBackup(baseUrl))}
        >
          Run backup
        </button>
        <ul>
          {backups.map((item) => (
            <li key={item.id}>
              {item.createdAt} · {item.status} ·{' '}
              {item.sizeBytes
                ? formatFileSize(BigInt(item.sizeBytes), browserLocale())
                : 'Size pending'}{' '}
              · verification {item.verificationResult ?? 'pending'}{' '}
              {item.status === 'completed' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => verifyBackup(baseUrl, item.id))}
                >
                  Verify backup
                </button>
              )}
              {item.status === 'verified' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => rehearseBackup(baseUrl, item.id))}
                >
                  Run restore rehearsal
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section id="operations-rehearsals">
        <h3>Restore rehearsals</h3>
        <p>Latest: {status?.latestRehearsal?.status ?? 'None'}</p>
      </section>
      <section id="operations-scheduled" aria-label="Scheduled tasks">
        <h3>Scheduled tasks</h3>
        <p>Automatic scheduled execution: {scheduler?.status ?? 'Unknown'}</p>
        <p>Last poll: {scheduler?.lastPollAt ?? 'Never'}</p>
        <p>
          Last successful task: {scheduler?.lastSuccessfulTaskAt ?? 'Never'}
        </p>
        <p>Running tasks: {scheduler?.runningTaskCount ?? 0}</p>
        <p>Recent failed tasks: {scheduler?.recentFailedTaskCount ?? 0}</p>
        <h4>Backup policy</h4>
        <ul>
          {duePolicies.map((policy) => (
            <li key={policy.scope}>
              {policy.scope}: {policy.enabled ? 'enabled' : 'disabled'} ·{' '}
              {policy.frequency} · verification{' '}
              {policy.verificationRequired ? 'required' : 'optional'} · retain{' '}
              {policy.retentionCount} · {policy.due ? 'due' : 'not due'}
            </li>
          ))}
        </ul>
        <h4>Recent executions</h4>
        <ul>
          {executions.map((execution) => (
            <li key={execution.id}>
              {execution.taskType} · {execution.status} · attempt{' '}
              {execution.attempt} · scheduled {execution.scheduledFor} · started{' '}
              {execution.startedAt ?? 'pending'} · ended{' '}
              {execution.completedAt ?? 'pending'}
              {execution.failureCode && <> · {execution.failureCode}</>}
              {execution.eligibleCount !== null && (
                <> · eligible records {execution.eligibleCount}</>
              )}
              {execution.retryEligible && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => retryScheduledExecution(baseUrl, execution.id))
                  }
                >
                  Retry scheduled task
                </button>
              )}
            </li>
          ))}
        </ul>
        <p>
          Manual operator actions use the buttons in Backups and Maintenance.
        </p>
      </section>
      <section id="operations-incidents">
        <h3>Incidents</h3>
        <form onSubmit={submitIncident}>
          <label>
            Severity
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Incident title
            <input
              required
              minLength={3}
              value={incidentTitle}
              onChange={(event) => setIncidentTitle(event.target.value)}
            />
          </label>
          <label>
            Incident summary
            <textarea
              required
              minLength={3}
              value={incidentSummary}
              onChange={(event) => setIncidentSummary(event.target.value)}
            />
          </label>
          <button disabled={busy}>Open incident</button>
        </form>
        <ul>
          {incidents.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => openIncident(item.id)}>
                {item.title}
              </button>{' '}
              · {item.severity} · {item.status}
            </li>
          ))}
        </ul>
        {timeline && (
          <section aria-label="Incident timeline">
            <h4>{timeline.title}</h4>
            <ol>
              {timeline.updates.map((item) => (
                <li key={item.id}>
                  {item.createdAt} · {item.status}: {item.message}
                </li>
              ))}
            </ol>
            {timeline.status !== 'resolved' && (
              <>
                <label>
                  Update message
                  <input
                    value={updateMessage}
                    onChange={(event) => setUpdateMessage(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || updateMessage.trim().length < 3}
                  onClick={() =>
                    run(async () => {
                      await addIncidentUpdate(
                        baseUrl,
                        timeline.id,
                        updateMessage,
                      )
                      setTimeline(await getIncident(baseUrl, timeline.id))
                      setUpdateMessage('')
                    })
                  }
                >
                  Add update
                </button>
                {(['investigating', 'monitoring', 'resolved'] as const)
                  .filter((next) => next !== timeline.status)
                  .map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={busy || updateMessage.trim().length < 3}
                      onClick={() =>
                        run(async () => {
                          await changeIncidentStatus(
                            baseUrl,
                            timeline.id,
                            next,
                            updateMessage,
                          )
                          setTimeline(await getIncident(baseUrl, timeline.id))
                          setUpdateMessage('')
                        })
                      }
                    >
                      {next === 'resolved'
                        ? 'Resolve incident'
                        : `Move to ${next}`}
                    </button>
                  ))}
              </>
            )}
          </section>
        )}
      </section>
      <section id="operations-maintenance">
        <h3>Maintenance</h3>
        <form onSubmit={submitMaintenance}>
          <label>
            Maintenance title
            <input
              required
              minLength={3}
              value={maintenanceTitle}
              onChange={(event) => setMaintenanceTitle(event.target.value)}
            />
          </label>
          <label>
            Maintenance reason
            <input
              required
              minLength={3}
              value={maintenanceReason}
              onChange={(event) => setMaintenanceReason(event.target.value)}
            />
          </label>
          <label>
            Starts at
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label>
            Ends at
            <input
              required
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <button disabled={busy}>Schedule maintenance</button>
        </form>
        <ul>
          {maintenance.map((item) => (
            <li key={item.id}>
              {item.title} · {item.startsAt} to {item.endsAt} · {item.status}
              {item.status === 'scheduled' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      changeMaintenanceStatus(baseUrl, item.id, 'cancelled'),
                    )
                  }
                >
                  Cancel maintenance
                </button>
              )}
              {['scheduled', 'inProgress'].includes(item.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      changeMaintenanceStatus(baseUrl, item.id, 'completed'),
                    )
                  }
                >
                  Mark complete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section id="operations-metrics">
        <h3>Metrics</h3>
        <ul>
          {status?.metrics.map((item) => (
            <li key={item.route}>
              {item.route}: {item.requests} requests, {item.errors} errors,{' '}
              {item.durationMs} ms total
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
