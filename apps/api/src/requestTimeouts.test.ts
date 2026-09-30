import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import {
  installRequestTimeouts,
  requestTimeoutConfiguration,
  timeoutCategory,
} from './requestTimeouts.js'

describe('API request timeouts', () => {
  it('validates separate interactive and background limits', () => {
    expect(requestTimeoutConfiguration({})).toEqual({
      interactiveMs: 30_000,
      backgroundMs: 60_000,
    })
    expect(
      requestTimeoutConfiguration({
        WARKA_REQUEST_TIMEOUT_MS: '100',
        WARKA_BACKGROUND_REQUEST_TIMEOUT_MS: '500',
      }),
    ).toEqual({ interactiveMs: 100, backgroundMs: 500 })
    expect(() =>
      requestTimeoutConfiguration({ WARKA_REQUEST_TIMEOUT_MS: '1' }),
    ).toThrow('Invalid WARKA_REQUEST_TIMEOUT_MS')
  })

  it('exempts streams and gives background actions their own category', () => {
    expect(timeoutCategory('GET', '/files/:id/download')).toBe('fileStream')
    expect(timeoutCategory('POST', '/operations/backups')).toBe('background')
    expect(timeoutCategory('GET', '/students')).toBe('interactive')
  })

  it('returns a safe timeout response without a stack trace', async () => {
    const app = Fastify()
    installRequestTimeouts(app, { interactiveMs: 10, backgroundMs: 100 })
    app.get('/slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      return { completed: true }
    })
    const response = await app.inject('/slow')
    expect(response.statusCode).toBe(504)
    expect(response.json()).toEqual({
      error: {
        code: 'REQUEST_TIMEOUT',
        message: 'The request exceeded its processing time limit',
      },
    })
    expect(response.body).not.toContain('stack')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    await app.close()
  })
})
