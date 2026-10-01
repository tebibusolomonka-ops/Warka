import type { FaultController, FaultPoint } from './faultInjection.js'

export type MutationResult<T> =
  { ok: true; value: T } | { ok: false; code: 'DEPENDENCY_UNAVAILABLE' }

export async function atomicMutation<T>(
  faults: FaultController,
  point: FaultPoint,
  work: (stage: (value: T) => void) => Promise<void>,
): Promise<MutationResult<T>> {
  let staged: T | undefined
  try {
    faults.hit(point)
    await work((value) => {
      staged = value
    })
    faults.hit('transaction.commit')
    if (staged === undefined) throw new Error('Mutation produced no result')
    return { ok: true, value: staged }
  } catch {
    return { ok: false, code: 'DEPENDENCY_UNAVAILABLE' }
  }
}

export function dependencyReadiness(available: boolean) {
  return available
    ? { status: 'ready' as const }
    : { status: 'degraded' as const, code: 'DATABASE_UNAVAILABLE' as const }
}
