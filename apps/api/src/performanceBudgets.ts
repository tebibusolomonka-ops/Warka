import type { RequestLog } from './requestLogging.js'

export const performanceCategories = [
  'interactiveRead',
  'interactiveWrite',
  'search',
  'reporting',
  'fileStream',
  'backgroundAdmin',
] as const

export type PerformanceCategory = (typeof performanceCategories)[number]

const defaults: Record<PerformanceCategory, number> = {
  interactiveRead: 500,
  interactiveWrite: 1_000,
  search: 1_000,
  reporting: 3_000,
  fileStream: 10_000,
  backgroundAdmin: 10_000,
}

const envNames: Record<PerformanceCategory, string> = {
  interactiveRead: 'WARKA_BUDGET_INTERACTIVE_READ_MS',
  interactiveWrite: 'WARKA_BUDGET_INTERACTIVE_WRITE_MS',
  search: 'WARKA_BUDGET_SEARCH_MS',
  reporting: 'WARKA_BUDGET_REPORTING_MS',
  fileStream: 'WARKA_BUDGET_FILE_STREAM_MS',
  backgroundAdmin: 'WARKA_BUDGET_BACKGROUND_ADMIN_MS',
}

export function performanceBudgetConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  return Object.fromEntries(
    performanceCategories.map((category) => {
      const configured = Number(env[envNames[category]])
      return [
        category,
        Number.isFinite(configured) && configured >= 10 && configured <= 120_000
          ? configured
          : defaults[category],
      ]
    }),
  ) as Record<PerformanceCategory, number>
}

export function performanceCategory(
  entry: Pick<RequestLog, 'method' | 'route'>,
) {
  const route = entry.route.toLowerCase()
  if (route.includes('search')) return 'search' as const
  if (route.includes('report') || route.includes('dashboard'))
    return 'reporting' as const
  if (route.includes('download') || route.includes('/files/'))
    return 'fileStream' as const
  if (
    route.startsWith('/operations/') ||
    route.includes('/scheduler') ||
    route.includes('/rehearsal')
  )
    return 'backgroundAdmin' as const
  return ['GET', 'HEAD', 'OPTIONS'].includes(entry.method)
    ? ('interactiveRead' as const)
    : ('interactiveWrite' as const)
}

export class PerformanceBudgetMetrics {
  private readonly values = new Map<
    PerformanceCategory,
    {
      requests: number
      exceeded: number
      durationMs: number
      maxDurationMs: number
    }
  >()

  constructor(private readonly budgets = performanceBudgetConfiguration()) {}

  record(entry: RequestLog) {
    const category = performanceCategory(entry)
    const current = this.values.get(category) ?? {
      requests: 0,
      exceeded: 0,
      durationMs: 0,
      maxDurationMs: 0,
    }
    current.requests++
    current.durationMs += entry.durationMs
    current.maxDurationMs = Math.max(current.maxDurationMs, entry.durationMs)
    if (entry.durationMs > this.budgets[category]) current.exceeded++
    this.values.set(category, current)
  }

  snapshot() {
    return performanceCategories.map((category) => {
      const value = this.values.get(category) ?? {
        requests: 0,
        exceeded: 0,
        durationMs: 0,
        maxDurationMs: 0,
      }
      return { category, warningThresholdMs: this.budgets[category], ...value }
    })
  }
}
