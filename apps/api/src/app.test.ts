import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

const app = buildApp()

afterEach(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('returns a stable health response', async () => {
    const response = await app.inject('/health')

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
