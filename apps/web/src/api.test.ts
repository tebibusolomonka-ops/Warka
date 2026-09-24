import { describe, expect, it, vi } from 'vitest'
import { apiBaseUrl, getHealth } from './api'

describe('health client', () => {
  it('accepts a same-origin API path', () => {
    expect(apiBaseUrl('/api', 'http://localhost:5173')).toBe('http://localhost:5173/api')
  })

  it('rejects missing configuration', () => {
    expect(() => apiBaseUrl(undefined, 'http://localhost:5173')).toThrow()
  })

  it('returns a validated health response', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    await expect(getHealth('http://localhost:5173/api', request)).resolves.toEqual({ status: 'ok' })
    expect(request).toHaveBeenCalledWith('http://localhost:5173/api/health')
  })

  it('rejects invalid responses and request failures', async () => {
    const invalid = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'unknown' }) })
    const failed = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(getHealth('http://localhost/api', invalid)).rejects.toThrow()
    await expect(getHealth('http://localhost/api', failed)).rejects.toThrow('offline')
  })
})
