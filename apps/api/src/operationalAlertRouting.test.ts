import { describe, expect, it } from 'vitest'
import { routeAlertNotification } from './operationalAlertRouting.js'
import type { OperationalAlert } from './operationalAlertLifecycle.js'

const alert = (
  state: OperationalAlert['state'] = 'open',
): OperationalAlert => ({
  identity: 'database',
  policyId: 'database-availability',
  severity: 'critical',
  state,
  firstDetectedAt: new Date(1),
  lastDetectedAt: new Date(1),
  occurrenceCount: 1,
})

describe('operational alert notification routing', () => {
  it('notifies on state transitions without emailing every evaluation', () => {
    expect(
      routeAlertNotification(undefined, alert(), new Set())?.recipients,
    ).toBe('operations')
    expect(
      routeAlertNotification(
        alert(),
        { ...alert(), occurrenceCount: 2 },
        new Set(),
      ),
    ).toBeUndefined()
    expect(
      routeAlertNotification(
        alert(),
        { ...alert('resolved'), resolvedAt: new Date(2) },
        new Set(),
      )?.deduplicationKey,
    ).toContain('resolved')
  })

  it('contains policy facts without private record data', () => {
    expect(
      JSON.stringify(routeAlertNotification(undefined, alert(), new Set())),
    ).not.toMatch(/password|token|student/i)
  })
})
