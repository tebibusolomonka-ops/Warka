import { describe, expect, it } from 'vitest'
import {
  acknowledgeAlert,
  recordAlertEvaluation,
  type AlertStore,
  type OperationalAlert,
} from './operationalAlertLifecycle.js'

const store = () => {
  let value: OperationalAlert | undefined
  return {
    adapter: {
      findActive: async () => (value?.state === 'resolved' ? undefined : value),
      save: async (alert) => {
        value = alert
      },
    } satisfies AlertStore,
    current: () => value,
  }
}

describe('operational alert lifecycle', () => {
  it('deduplicates repeated detection and resolves only after recovery', async () => {
    const memory = store()
    const first = await recordAlertEvaluation(memory.adapter, {
      identity: 'database',
      policyId: 'database-availability',
      severity: 'critical',
      at: new Date(1),
    })
    await recordAlertEvaluation(memory.adapter, {
      identity: 'database',
      policyId: 'database-availability',
      severity: 'critical',
      at: new Date(2),
    })
    expect(memory.current()?.occurrenceCount).toBe(2)
    await acknowledgeAlert(memory.adapter, first!, 'operator', new Date(3))
    expect(memory.current()?.state).toBe('acknowledged')
    await recordAlertEvaluation(memory.adapter, {
      identity: 'database',
      policyId: 'database-availability',
      at: new Date(4),
    })
    expect(memory.current()?.state).toBe('resolved')
  })
})
