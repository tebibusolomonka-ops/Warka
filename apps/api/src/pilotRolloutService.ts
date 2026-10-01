import { missingPilotPrerequisites } from '@warka/database'

export type PilotStatus =
  'planned' | 'preparing' | 'ready' | 'active' | 'paused' | 'completed'
export type PilotRecord = {
  status: PilotStatus
  facts: Record<string, boolean>
  history: Array<{
    from: PilotStatus
    to: PilotStatus
    actorId: string
    reason: string
  }>
}

const transitions: Record<PilotStatus, PilotStatus[]> = {
  planned: ['preparing'],
  preparing: ['ready'],
  ready: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
}

export function transitionPilot(
  record: PilotRecord,
  target: PilotStatus,
  actor: { id: string; platformRollout: boolean },
  reason: string,
) {
  if (!actor.platformRollout)
    throw new Error('Platform rollout authorization required')
  if (!transitions[record.status].includes(target))
    throw new Error('Invalid pilot transition')
  if (target === 'ready' && missingPilotPrerequisites(record.facts).length > 0)
    throw new Error('Pilot prerequisites are incomplete')
  if (
    target === 'active' &&
    record.status !== 'ready' &&
    record.status !== 'paused'
  )
    throw new Error('Explicit ready or paused pilot required')
  return {
    ...record,
    status: target,
    history: [
      ...record.history,
      { from: record.status, to: target, actorId: actor.id, reason },
    ],
  }
}
