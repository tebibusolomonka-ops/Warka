import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { ServiceMetrics, registerMetricsRoutes } from './serviceMetrics.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'

describe('service metrics', () => {
  it('uses route patterns without personal labels and counts failures', () => {
    const metrics = new ServiceMetrics()
    metrics.record({
      correlationId: 'one',
      actorId,
      method: 'GET',
      route: '/students/:id',
      statusCode: 500,
      durationMs: 12,
    })
    expect(metrics.snapshot()).toEqual([
      { route: 'GET /students/:id', requests: 1, errors: 1, durationMs: 12 },
    ])
    expect(JSON.stringify(metrics.snapshot())).not.toContain(actorId)
  })

  it('requires an explicitly authorized operator', async () => {
    const app = Fastify()
    app.decorateRequest('currentUser', null)
    const database = {
      organizationMembership: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient
    registerMetricsRoutes(
      app,
      () => database,
      async (request, reply) => {
        if (!request.headers['x-user']) return reply.code(401).send()
        request.currentUser = { id: actorId } as User
      },
      new ServiceMetrics(),
    )
    app.setErrorHandler((_error, _request, reply) => reply.code(403).send())
    expect((await app.inject('/operations/metrics')).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          url: '/operations/metrics',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    await app.close()
  })
})
