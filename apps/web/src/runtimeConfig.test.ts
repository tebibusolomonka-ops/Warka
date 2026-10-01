import { afterEach, describe, expect, it } from 'vitest'
import { publicApiBaseUrl } from './runtimeConfig'

afterEach(() => delete window.__WARKA_PUBLIC_CONFIG__)

describe('public runtime configuration', () => {
  it('uses controlled runtime configuration before the public build value', () => {
    window.__WARKA_PUBLIC_CONFIG__ = { apiBaseUrl: '/api' }
    expect(publicApiBaseUrl('/build-api')).toBe('/api')
  })

  it('falls back to the public build value', () => {
    expect(publicApiBaseUrl('/api')).toBe('/api')
  })
})
