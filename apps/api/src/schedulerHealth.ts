import type { PrismaClient } from '@warka/database'

export class SchedulerHealthMonitor {
  private enabled = false
  private intervalMs = 60_000
  private lastPollAt: Date | null = null
  private lastSuccessfulTaskAt: Date | null = null
  private runningTaskCount = 0

  configure(enabled: boolean, intervalMs: number) {
    this.enabled = enabled
    this.intervalMs = intervalMs
    this.lastPollAt = null
    this.lastSuccessfulTaskAt = null
    this.runningTaskCount = 0
  }

  polled(at = new Date()) {
    this.lastPollAt = at
  }

  async track<T>(work: () => Promise<T>): Promise<T> {
    this.runningTaskCount += 1
    try {
      const result = await work()
      this.lastSuccessfulTaskAt = new Date()
      return result
    } finally {
      this.runningTaskCount -= 1
    }
  }

  async snapshot(database: PrismaClient, now = new Date()) {
    if (!this.enabled)
      return {
        status: 'disabled' as const,
        enabled: false,
        lastPollAt: this.lastPollAt,
        lastSuccessfulTaskAt: this.lastSuccessfulTaskAt,
        runningTaskCount: this.runningTaskCount,
        recentFailedTaskCount: 0,
      }
    const recentFailedTaskCount = await database.scheduledTaskExecution.count({
      where: {
        status: 'failed',
        completedAt: { gte: new Date(now.getTime() - 86_400_000) },
      },
    })
    const stale =
      !this.lastPollAt ||
      now.getTime() - this.lastPollAt.getTime() > this.intervalMs * 3
    return {
      status:
        stale || recentFailedTaskCount > 0
          ? ('degraded' as const)
          : ('healthy' as const),
      enabled: true,
      lastPollAt: this.lastPollAt,
      lastSuccessfulTaskAt: this.lastSuccessfulTaskAt,
      runningTaskCount: this.runningTaskCount,
      recentFailedTaskCount,
    }
  }
}

export const schedulerHealth = new SchedulerHealthMonitor()
