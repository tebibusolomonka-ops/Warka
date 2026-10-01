export type WorkState = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'REVIEW'
export type WorkItem = {
  state: WorkState
  leaseOwner?: string
  leaseUntil?: number
  externalEffectPossible?: boolean
}

export function reconcileInterrupted(item: WorkItem, now: number): WorkItem {
  if (item.state !== 'RUNNING' || (item.leaseUntil ?? Infinity) > now)
    return item
  if (item.externalEffectPossible) return { state: 'REVIEW' }
  return { state: 'PENDING' }
}

export function claim(
  item: WorkItem,
  worker: string,
  now: number,
  leaseMs: number,
): boolean {
  if (item.state !== 'PENDING') return false
  Object.assign(item, {
    state: 'RUNNING',
    leaseOwner: worker,
    leaseUntil: now + leaseMs,
  })
  return true
}
