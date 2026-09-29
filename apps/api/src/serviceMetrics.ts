import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { databaseQueryMetrics, type PrismaClient } from '@warka/database'
import type { RequestLog } from './requestLogging.js'
import { authenticatedUser } from './authenticateRequest.js'
import { requireOperator } from './operationsAccess.js'
import { PerformanceBudgetMetrics } from './performanceBudgets.js'

export class ServiceMetrics {
  readonly performanceBudgets = new PerformanceBudgetMetrics()
  private readonly counts = new Map<
    string,
    { requests: number; errors: number; durationMs: number }
  >()
  record(entry: RequestLog) {
    this.performanceBudgets.record(entry)
    const key = `${entry.method} ${entry.route}`
    const current = this.counts.get(key) ?? {
      requests: 0,
      errors: 0,
      durationMs: 0,
    }
    current.requests++
    if (entry.statusCode >= 500) current.errors++
    current.durationMs += entry.durationMs
    this.counts.set(key, current)
  }
  snapshot() {
    return [...this.counts]
      .map(([route, value]) => ({ route, ...value }))
      .sort((a, b) => a.route.localeCompare(b.route))
  }
}

export function registerMetricsRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
  metrics: ServiceMetrics,
) {
  app.get(
    '/operations/metrics',
    { preHandler: authenticate },
    async (request) => {
      await requireOperator(getDatabase(), authenticatedUser(request).id)
      return {
        http: metrics.snapshot(),
        performanceBudgets: metrics.performanceBudgets.snapshot(),
        database: databaseQueryMetrics.snapshot(),
      }
    },
  )
}
