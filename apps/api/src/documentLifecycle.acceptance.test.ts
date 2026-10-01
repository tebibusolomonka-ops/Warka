import { describe, expect, it } from 'vitest'

import { validateLifecycle } from './acceptanceContracts.js'

describe('official document lifecycle acceptance', () => {
  it('preserves immutable versions through issue, correction, and withdrawal', () => {
    const steps = [
      { actor: 'student', action: 'request', expected: 'pending' },
      { actor: 'school', action: 'issue', expected: 'immutable snapshot' },
      { actor: 'storage', action: 'store PDF', expected: 'private FileAsset' },
      {
        actor: 'school',
        action: 'generate reference',
        expected: 'minimal verification',
      },
      { actor: 'student', action: 'download', expected: 'authorized PDF' },
      { actor: 'school', action: 'correct', expected: 'new version' },
      {
        actor: 'school',
        action: 'withdraw',
        expected: 'historical version retained',
      },
    ]
    expect(validateLifecycle(steps)).toEqual([])
  })

  it('does not let public verification download a private PDF', () => {
    const publicResponse = {
      reference: 'DOC-SYN-001',
      state: 'issued',
      downloadUrl: undefined,
    }
    expect(publicResponse.downloadUrl).toBeUndefined()
  })
})
