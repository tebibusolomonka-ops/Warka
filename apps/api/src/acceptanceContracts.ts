export type LifecycleStep = { action: string; actor: string; expected: string }

export function validateLifecycle(steps: readonly LifecycleStep[]): string[] {
  const aliases = new Set<string>()
  const violations: string[] = []
  for (const step of steps) {
    if (!step.action || !step.actor || !step.expected)
      violations.push('INCOMPLETE_STEP')
    const key = `${step.actor}:${step.action}`
    if (aliases.has(key)) violations.push('DUPLICATE_STEP')
    aliases.add(key)
  }
  return violations
}
