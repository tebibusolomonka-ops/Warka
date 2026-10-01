import { describe, expect, it } from 'vitest'
import {
  evaluateAlertPolicy,
  operationalAlertPolicies,
} from './operationalAlertPolicies.js'

describe('operational alert policies', () => {
  it('evaluates explicit warning and critical thresholds', () => {
    const policy = operationalAlertPolicies.find(
      ({ id }) => id === 'api-error-rate',
    )!
    expect(evaluateAlertPolicy(policy, 0.01)).toBeUndefined()
    expect(evaluateAlertPolicy(policy, 0.03)).toBe('warning')
    expect(evaluateAlertPolicy(policy, 0.06)).toBe('critical')
  })

  it('uses bounded signal and policy identities', () => {
    expect(new Set(operationalAlertPolicies.map(({ id }) => id)).size).toBe(
      operationalAlertPolicies.length,
    )
    expect(
      operationalAlertPolicies.every(({ signal }) => !signal.includes(':')),
    ).toBe(true)
  })
})
