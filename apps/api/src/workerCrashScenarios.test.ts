import { describe, expect, it } from 'vitest'

import { claim, reconcileInterrupted, type WorkItem } from './workerRecovery.js'

describe('worker crash recovery', () => {
  for (const task of ['backup', 'file scan', 'retention', 'digest']) {
    it(`requeues interrupted ${task} after lease expiry`, () => {
      const item: WorkItem = { state: 'PENDING' }
      expect(claim(item, 'worker-a', 100, 10)).toBe(true)
      expect(claim(item, 'worker-b', 101, 10)).toBe(false)
      expect(reconcileInterrupted(item, 111)).toEqual({ state: 'PENDING' })
    })
  }

  it('sends ambiguous email effects to review instead of blind replay', () => {
    const email: WorkItem = {
      state: 'RUNNING',
      leaseOwner: 'worker-a',
      leaseUntil: 110,
      externalEffectPossible: true,
    }
    expect(reconcileInterrupted(email, 111)).toEqual({ state: 'REVIEW' })
  })
})
