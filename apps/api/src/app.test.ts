import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { PrismaClient } from '@warka/database'

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

describe('GET /ready', () => {
  it('returns only a public readiness result', async () => {
    const readyApp = buildApp({
      database: {
        $queryRaw: async () => {
          throw new Error('private database detail')
        },
      } as unknown as PrismaClient,
    })
    const response = await readyApp.inject('/ready')
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'unavailable' })
    expect(response.body).not.toContain('private database detail')
    await readyApp.close()
  })
})
