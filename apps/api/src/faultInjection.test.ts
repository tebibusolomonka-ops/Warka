import { describe, expect, it } from 'vitest'

import { FaultController, InjectedFault } from './faultInjection.js'

describe('FaultController', () => {
  it('fires an explicitly named fault the configured number of times', () => {
    const faults = new FaultController('test')
    faults.enable('database.operation', 2)

    expect(() => faults.hit('database.operation')).toThrow(InjectedFault)
    expect(() => faults.hit('database.operation')).toThrow(InjectedFault)
    expect(() => faults.hit('database.operation')).not.toThrow()
  })

  it('keeps fault state scoped to its instance', () => {
    const first = new FaultController('test')
    const second = new FaultController('test')
    first.enable('storage.operation')

    expect(() => second.hit('storage.operation')).not.toThrow()
  })

  it('refuses to activate in production', () => {
    expect(() => new FaultController('production')).toThrow(
      'Fault injection is unavailable in production',
    )
  })
})
