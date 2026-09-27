import { describe, expect, it } from 'vitest'
import { OperationalIncidentInputSchema } from './operationalIncidentInput.js'

describe('operational incident input', () => {
  it('accepts a controlled severity and plain operational text', () => {
    expect(
      OperationalIncidentInputSchema.parse({
        severity: 'critical',
        title: 'Database unavailable',
        summary: 'Database connection checks are failing',
      }).severity,
    ).toBe('critical')
    expect(() =>
      OperationalIncidentInputSchema.parse({
        severity: 'urgent',
        title: 'Outage',
        summary: 'Service issue',
      }),
    ).toThrow()
    expect(() =>
      OperationalIncidentInputSchema.parse({
        severity: 'high',
        title: '<b>Outage</b>',
        summary: 'Service issue',
      }),
    ).toThrow()
    expect(() =>
      OperationalIncidentInputSchema.parse({
        severity: 'high',
        title: 'Outage',
        summary: 'student@example.test',
      }),
    ).toThrow()
  })
})
