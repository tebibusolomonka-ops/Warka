import { describe, expect, it } from 'vitest'
import {
  appendEscalationHistory,
  evaluateSupportEscalation,
  SupportEscalationPolicySchema,
} from './supportEscalationPolicies.js'

describe('support escalation policies', () => {
  const policy = SupportEscalationPolicySchema.parse({
    id: 'urgent-operations',
    categories: ['service'],
    severities: ['urgent'],
    unresolvedMinutes: 30,
    serviceImpact: 'broad',
    target: 'operations',
  })

  it('uses factual case and service fields', () => {
    expect(
      evaluateSupportEscalation(policy, {
        category: 'service',
        severity: 'urgent',
        unresolvedMinutes: 31,
        serviceImpact: 'broad',
      }),
    ).toEqual({
      policyId: 'urgent-operations',
      target: 'operations',
      action: 'escalate',
    })
  })

  it('appends history without silently closing or reassigning a case', () => {
    const previous = [{ action: 'created' }]
    const next = appendEscalationHistory(previous, { action: 'escalated' })
    expect(previous).toEqual([{ action: 'created' }])
    expect(next).toHaveLength(2)
  })
})
