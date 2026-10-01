import { describe, expect, it } from 'vitest'

import { FaultController } from './faultInjection.js'
import { atomicMutation, dependencyReadiness } from './outageSafety.js'

describe('database outage safety', () => {
  for (const workflow of [
    'student registration',
    'attendance submission',
    'gradebook write',
    'reporting submission',
    'background worker claim',
  ]) {
    it(`does not report false success for ${workflow}`, async () => {
      const faults = new FaultController('test')
      faults.enable('database.operation')
      const durable: string[] = []
      const result = await atomicMutation(
        faults,
        'database.operation',
        async (stage) => {
          stage(workflow)
          durable.push(workflow)
        },
      )
      expect(result).toEqual({ ok: false, code: 'DEPENDENCY_UNAVAILABLE' })
      expect(durable).toEqual([])
    })
  }

  it('reports degradation without exposing credentials', () => {
    expect(JSON.stringify(dependencyReadiness(false))).toBe(
      '{"status":"degraded","code":"DATABASE_UNAVAILABLE"}',
    )
  })
})
