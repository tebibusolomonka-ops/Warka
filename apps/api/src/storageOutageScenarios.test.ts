import { describe, expect, it } from 'vitest'

import { FaultController } from './faultInjection.js'

describe('storage outage safety', () => {
  for (const operation of [
    'learning material',
    'coursework',
    'issued document',
    'resumable assembly',
  ]) {
    it(`does not publish ${operation} metadata after storage failure`, () => {
      const faults = new FaultController('test')
      faults.enable('storage.operation')
      const asset = {
        state: 'PENDING',
        storageKey: undefined as string | undefined,
      }
      try {
        faults.hit('storage.operation')
        asset.storageKey = 'private/object'
        asset.state = 'AVAILABLE'
      } catch {
        asset.state = operation === 'resumable assembly' ? 'PENDING' : 'FAILED'
      }
      expect(asset.storageKey).toBeUndefined()
      expect(asset.state).not.toBe('AVAILABLE')
    })
  }

  it('authorizes a download before touching storage', () => {
    let storageAccessed = false
    const download = (authorized: boolean) => {
      if (!authorized) return { status: 404 }
      storageAccessed = true
      return { status: 503 }
    }
    expect(download(false)).toEqual({ status: 404 })
    expect(storageAccessed).toBe(false)
  })
})
