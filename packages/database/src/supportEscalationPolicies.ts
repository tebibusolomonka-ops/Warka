import { z } from 'zod'

export const SupportEscalationPolicySchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
  categories: z.array(z.string().min(2).max(40)).min(1),
  severities: z.array(z.enum(['normal', 'urgent'])).min(1),
  unresolvedMinutes: z.number().int().min(0).max(43_200),
  serviceImpact: z.enum(['none', 'limited', 'broad']),
  target: z.enum(['schoolSupport', 'platformSupport', 'operations']),
})

export type SupportEscalationPolicy = z.infer<
  typeof SupportEscalationPolicySchema
>

export function evaluateSupportEscalation(
  policy: SupportEscalationPolicy,
  supportCase: {
    category: string
    severity: 'normal' | 'urgent'
    unresolvedMinutes: number
    serviceImpact: 'none' | 'limited' | 'broad'
  },
) {
  const matched =
    policy.categories.includes(supportCase.category) &&
    policy.severities.includes(supportCase.severity) &&
    supportCase.unresolvedMinutes >= policy.unresolvedMinutes &&
    (policy.serviceImpact === 'none' ||
      policy.serviceImpact === supportCase.serviceImpact)
  return matched
    ? {
        policyId: policy.id,
        target: policy.target,
        action: 'escalate' as const,
      }
    : undefined
}

export function appendEscalationHistory<T>(history: readonly T[], event: T) {
  return [...history, event]
}
