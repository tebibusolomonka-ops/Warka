import type { OperationalAlert } from './operationalAlertLifecycle.js'

export type AlertNotification = {
  deduplicationKey: string
  subject: string
  body: string
  recipients: 'operations'
}

export function routeAlertNotification(
  previous: OperationalAlert | undefined,
  current: OperationalAlert,
  configuredWarnings: ReadonlySet<string>,
): AlertNotification | undefined {
  const opened = !previous && current.state === 'open'
  const resolvedCritical =
    previous?.severity === 'critical' && current.state === 'resolved'
  const warningEnabled =
    current.severity === 'warning' && configuredWarnings.has(current.policyId)
  if (!(
    resolvedCritical ||
    (opened && (current.severity === 'critical' || warningEnabled))
  ))
    return undefined
  const transition = current.state === 'resolved' ? 'resolved' : 'opened'
  return {
    deduplicationKey: `operational-alert:${current.identity}:${transition}`,
    subject: `Operational alert ${transition}: ${current.policyId}`,
    body: `Policy ${current.policyId} is ${current.state}. Review Warka Operations for current evidence.`,
    recipients: 'operations',
  }
}
