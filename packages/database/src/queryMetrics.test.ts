import { describe, expect, it } from 'vitest'
import {
  DatabaseQueryMetrics,
  queryCategory,
  slowQueryThreshold,
} from './queryMetrics.js'

describe('safe query metrics', () => {
  it('uses low-cardinality operation categories without retaining SQL', () => {
    const metrics = new DatabaseQueryMetrics()
    metrics.record({
      category: queryCategory('SELECT * FROM "Student" WHERE email = $1'),
      durationMs: 320,
      success: true,
      slowThresholdMs: 250,
    })
    expect(metrics.snapshot()).toEqual([
      {
        category: 'select',
        count: 1,
        failures: 0,
        durationMs: 320,
        slow: 1,
      },
    ])
    const serialized = JSON.stringify(metrics.snapshot())
    expect(serialized).not.toContain('Student')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('$1')
  })

  it('validates the slow query threshold', () => {
    expect(slowQueryThreshold({ WARKA_SLOW_QUERY_MS: '500' })).toBe(500)
    expect(() => slowQueryThreshold({ WARKA_SLOW_QUERY_MS: '1' })).toThrow()
  })
})
