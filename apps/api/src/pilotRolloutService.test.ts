import { describe, expect, it } from 'vitest'
import { pilotPrerequisites } from '@warka/database'
import { transitionPilot, type PilotRecord } from './pilotRolloutService.js'

const facts = Object.fromEntries(pilotPrerequisites.map((item) => [item, true]))

describe('pilot rollout workflow', () => {
  it('requires an explicit authorized activation and preserves history', () => {
    const ready: PilotRecord = { status: 'ready', facts, history: [] }
    const active = transitionPilot(
      ready,
      'active',
      { id: 'rollout-user', platformRollout: true },
      'Approved go-live',
    )
    expect(active.status).toBe('active')
    expect(active.history).toEqual([
      {
        from: 'ready',
        to: 'active',
        actorId: 'rollout-user',
        reason: 'Approved go-live',
      },
    ])
  })

  it('denies school staff and incomplete readiness', () => {
    expect(() =>
      transitionPilot(
        { status: 'ready', facts, history: [] },
        'active',
        { id: 'teacher', platformRollout: false },
        'Start',
      ),
    ).toThrow()
    expect(() =>
      transitionPilot(
        { status: 'preparing', facts: {}, history: [] },
        'ready',
        { id: 'rollout-user', platformRollout: true },
        'Ready',
      ),
    ).toThrow('incomplete')
  })
})
