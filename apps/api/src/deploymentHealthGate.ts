import type { DeploymentReadiness } from './deploymentReadiness.js'

export type DeploymentHealthGate = {
  status: 'healthy' | 'degraded' | 'blocked'
  reasons: string[]
}

export function evaluateDeploymentHealthGate(input: {
  readiness: DeploymentReadiness
  apiVersion: string
  webVersion: string
  scheduler: 'healthy' | 'degraded' | 'disabled'
  workersRecovered: boolean
}): DeploymentHealthGate {
  const reasons = [...input.readiness.reasons]
  if (input.apiVersion !== input.webVersion)
    reasons.push('releaseVersionMismatch')
  if (input.scheduler === 'degraded') reasons.push('schedulerDegraded')
  if (!input.workersRecovered) reasons.push('workerRecoveryIncomplete')
  const blocked =
    input.readiness.status === 'blocked' ||
    reasons.some((reason) =>
      ['releaseVersionMismatch', 'workerRecoveryIncomplete'].includes(reason),
    )
  return {
    status: blocked ? 'blocked' : reasons.length ? 'degraded' : 'healthy',
    reasons,
  }
}
