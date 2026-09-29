export type QueryCategory =
  'select' | 'insert' | 'update' | 'delete' | 'transaction' | 'other'

export class DatabaseQueryMetrics {
  private readonly values = new Map<
    QueryCategory,
    { count: number; failures: number; durationMs: number; slow: number }
  >()

  record(input: {
    category: QueryCategory
    durationMs: number
    success: boolean
    slowThresholdMs: number
  }) {
    const current = this.values.get(input.category) ?? {
      count: 0,
      failures: 0,
      durationMs: 0,
      slow: 0,
    }
    current.count += 1
    current.durationMs += Math.max(0, input.durationMs)
    if (!input.success) current.failures += 1
    if (input.durationMs >= input.slowThresholdMs) current.slow += 1
    this.values.set(input.category, current)
  }

  snapshot() {
    return [...this.values].map(([category, value]) => ({
      category,
      ...value,
    }))
  }

  reset() {
    this.values.clear()
  }
}

export function queryCategory(query: string): QueryCategory {
  const operation = query.trimStart().split(/\s+/, 1)[0]?.toUpperCase()
  if (operation === 'SELECT' || operation === 'WITH') return 'select'
  if (operation === 'INSERT') return 'insert'
  if (operation === 'UPDATE') return 'update'
  if (operation === 'DELETE') return 'delete'
  if (
    operation === 'BEGIN' ||
    operation === 'COMMIT' ||
    operation === 'ROLLBACK'
  )
    return 'transaction'
  return 'other'
}

export function slowQueryThreshold(env: NodeJS.ProcessEnv = process.env) {
  const value = Number(env.WARKA_SLOW_QUERY_MS ?? 250)
  if (!Number.isInteger(value) || value < 10 || value > 60_000)
    throw new Error('Invalid slow query threshold')
  return value
}

export const databaseQueryMetrics = new DatabaseQueryMetrics()
