import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from './externalUrl.js'

describe('external URL policy', () => {
  it('accepts HTTPS and intentionally permitted HTTP', () => {
    expect(safeExternalUrl('https://example.test/resource')).toBe(
      'https://example.test/resource',
    )
    expect(safeExternalUrl('http://localhost:3000', { allowHttp: true })).toBe(
      'http://localhost:3000/',
    )
  })
  it('rejects dangerous schemes, credentials, and control characters', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///tmp/x',
      'https://user:pass@example.test',
      'https://example.test/\nInjected',
    ])
      expect(safeExternalUrl(value)).toBeNull()
  })
})
