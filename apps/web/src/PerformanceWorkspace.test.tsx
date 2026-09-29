import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PerformanceWorkspace } from './PerformanceWorkspace'
import { getPerformanceSummary } from './operationsApi'

vi.mock('./operationsApi', () => ({ getPerformanceSummary: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('renders safe performance categories, database health, and queue depth', async () => {
  vi.mocked(getPerformanceSummary).mockResolvedValue({
    requestCategories: [
      {
        category: 'search',
        warningThresholdMs: 1000,
        requests: 10,
        exceeded: 1,
        durationMs: 2200,
        maxDurationMs: 1200,
      },
    ],
    databaseQueries: [
      { category: 'select', count: 12, failures: 0, slow: 1, durationMs: 500 },
    ],
    database: {
      state: 'ready',
      pool: {
        status: 'configured',
        connectionLimit: 10,
        poolTimeoutSeconds: 10,
      },
    },
    queueDepth: [{ category: 'fileScan', count: 2 }],
    loadTest: null,
  })
  render(<PerformanceWorkspace baseUrl="/api" />)
  expect(await screen.findByText('Database readiness: ready')).toBeTruthy()
  expect(
    screen.getByText(/search: 10 requests, 1 budget warnings/),
  ).toBeTruthy()
  expect(screen.getByText(/select: 12 queries, 1 slow/)).toBeTruthy()
  expect(screen.getByText('fileScan: 2')).toBeTruthy()
})
