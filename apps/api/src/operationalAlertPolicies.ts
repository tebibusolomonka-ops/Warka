export type AlertSeverity = 'warning' | 'critical'

export type AlertPolicy = {
  id: string
  signal: string
  warning?: number
  critical: number
  comparison: 'above' | 'below'
}

export const operationalAlertPolicies: readonly AlertPolicy[] = [
  {
    id: 'api-readiness',
    signal: 'api_ready',
    critical: 1,
    comparison: 'below',
  },
  {
    id: 'database-availability',
    signal: 'database_ready',
    critical: 1,
    comparison: 'below',
  },
  {
    id: 'api-error-rate',
    signal: 'api_error_rate',
    warning: 0.02,
    critical: 0.05,
    comparison: 'above',
  },
  {
    id: 'request-latency',
    signal: 'request_latency_ms',
    warning: 750,
    critical: 1500,
    comparison: 'above',
  },
  {
    id: 'worker-backlog',
    signal: 'scheduled_worker_backlog',
    warning: 25,
    critical: 100,
    comparison: 'above',
  },
  {
    id: 'email-backlog',
    signal: 'email_outbox_backlog',
    warning: 50,
    critical: 250,
    comparison: 'above',
  },
  {
    id: 'scan-backlog',
    signal: 'file_scan_backlog',
    warning: 25,
    critical: 100,
    comparison: 'above',
  },
  {
    id: 'backup-age',
    signal: 'backup_age_hours',
    warning: 25,
    critical: 49,
    comparison: 'above',
  },
  {
    id: 'restore-age',
    signal: 'restore_rehearsal_age_days',
    warning: 31,
    critical: 61,
    comparison: 'above',
  },
  {
    id: 'scheduler-health',
    signal: 'scheduler_ready',
    critical: 1,
    comparison: 'below',
  },
  {
    id: 'storage-health',
    signal: 'storage_ready',
    critical: 1,
    comparison: 'below',
  },
  {
    id: 'migration-state',
    signal: 'migration_current',
    critical: 1,
    comparison: 'below',
  },
  {
    id: 'deployment-health',
    signal: 'deployment_allowed',
    critical: 1,
    comparison: 'below',
  },
] as const

export function evaluateAlertPolicy(
  policy: AlertPolicy,
  value: number,
): AlertSeverity | undefined {
  const triggered = (threshold: number) =>
    policy.comparison === 'above' ? value > threshold : value < threshold
  if (triggered(policy.critical)) return 'critical'
  if (policy.warning !== undefined && triggered(policy.warning))
    return 'warning'
  return undefined
}
