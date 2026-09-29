import { describe, expect, it } from 'vitest'
import {
  PerformanceBudgetMetrics,
  performanceBudgetConfiguration,
  performanceCategory,
} from './performanceBudgets.js'

const entry = (route: string, method = 'GET', durationMs = 20) => ({
  correlationId: 'not-retained',
  method,
  route,
  statusCode: 200,
  durationMs,
})

describe('request performance budgets', () => {
  it('classifies normalized routes into broad operational categories', () => {
    expect(performanceCategory(entry('/students/search'))).toBe('search')
    expect(performanceCategory(entry('/reports/dashboard'))).toBe('reporting')
    expect(performanceCategory(entry('/files/:id/download'))).toBe('fileStream')
    expect(performanceCategory(entry('/operations/recovery'))).toBe(
      'backgroundAdmin',
    )
    expect(performanceCategory(entry('/students', 'POST'))).toBe(
      'interactiveWrite',
    )
  })

  it('records warnings without retaining private request labels', () => {
    const metrics = new PerformanceBudgetMetrics(
      performanceBudgetConfiguration({ WARKA_BUDGET_SEARCH_MS: '25' }),
    )
    metrics.record(entry('/students/search', 'GET', 30))
    const search = metrics.snapshot().find((item) => item.category === 'search')
    expect(search).toMatchObject({ requests: 1, exceeded: 1 })
    expect(JSON.stringify(metrics.snapshot())).not.toContain('/students/search')
    expect(JSON.stringify(metrics.snapshot())).not.toContain('not-retained')
  })
})
