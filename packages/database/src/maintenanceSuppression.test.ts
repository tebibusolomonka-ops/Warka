import { describe, expect, it } from 'vitest'
import { maintenanceEffect } from './maintenanceWindows.js'

describe('maintenance alert semantics', () => {
  it('suppresses only related availability notifications without hiding health', () => {
    expect(
      maintenanceEffect('database', {
        signal: 'database_ready',
        category: 'availability',
      }),
    ).toEqual({
      affected: true,
      suppressNotification: true,
      underlyingHealthy: false,
    })
    expect(
      maintenanceEffect('database', {
        signal: 'database_integrity',
        category: 'integrity',
      }).suppressNotification,
    ).toBe(false)
    expect(
      maintenanceEffect('platform', {
        signal: 'login_attack',
        category: 'security',
      }).suppressNotification,
    ).toBe(false)
  })
})
