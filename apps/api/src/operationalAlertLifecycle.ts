import type { AlertSeverity } from './operationalAlertPolicies.js'

export type AlertState = 'open' | 'acknowledged' | 'resolved'
export type OperationalAlert = {
  identity: string
  policyId: string
  severity: AlertSeverity
  state: AlertState
  firstDetectedAt: Date
  lastDetectedAt: Date
  occurrenceCount: number
  acknowledgedAt?: Date
  acknowledgedBy?: string
  resolvedAt?: Date
}

export interface AlertStore {
  findActive(identity: string): Promise<OperationalAlert | undefined>
  save(alert: OperationalAlert): Promise<void>
}

export async function recordAlertEvaluation(
  store: AlertStore,
  input: {
    identity: string
    policyId: string
    severity?: AlertSeverity
    at: Date
  },
) {
  const active = await store.findActive(input.identity)
  if (!input.severity) {
    if (!active) return undefined
    const resolved = {
      ...active,
      state: 'resolved' as const,
      resolvedAt: input.at,
    }
    await store.save(resolved)
    return resolved
  }
  const alert = active
    ? {
        ...active,
        severity: input.severity,
        lastDetectedAt: input.at,
        occurrenceCount: active.occurrenceCount + 1,
      }
    : {
        identity: input.identity,
        policyId: input.policyId,
        severity: input.severity,
        state: 'open' as const,
        firstDetectedAt: input.at,
        lastDetectedAt: input.at,
        occurrenceCount: 1,
      }
  await store.save(alert)
  return alert
}

export async function acknowledgeAlert(
  store: AlertStore,
  alert: OperationalAlert,
  actorId: string,
  at: Date,
) {
  const acknowledged = {
    ...alert,
    state: 'acknowledged' as const,
    acknowledgedAt: at,
    acknowledgedBy: actorId,
  }
  await store.save(acknowledged)
  return acknowledged
}
