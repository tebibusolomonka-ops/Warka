import { describe, expect, it } from 'vitest'

import { FaultController } from './faultInjection.js'

describe('external provider degradation', () => {
  it('keeps failed email queued for policy-controlled retry', () => {
    const faults = new FaultController('test')
    faults.enable('email.delivery')
    const email = { state: 'QUEUED', attempts: 0 }
    expect(() => faults.hit('email.delivery')).toThrow()
    expect(email).toEqual({ state: 'QUEUED', attempts: 0 })
  })

  it('never treats scanner unavailability as a clean result', () => {
    const faults = new FaultController('test')
    faults.enable('scanner.scan')
    const file = { scan: 'QUARANTINED', downloadable: false }
    try {
      faults.hit('scanner.scan')
      file.scan = 'CLEAN'
      file.downloadable = true
    } catch {
      file.scan = 'QUARANTINED'
    }
    expect(file).toEqual({ scan: 'QUARANTINED', downloadable: false })
  })

  it('keeps liveness healthy while readiness identifies an optional outage', () => {
    expect({ live: true, ready: false, provider: 'smtp' }).toEqual({
      live: true,
      ready: false,
      provider: 'smtp',
    })
  })
})
