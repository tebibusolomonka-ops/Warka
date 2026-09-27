import type { PrismaClient } from '@warka/database'
import {
  completeScheduledTask,
  failScheduledTask,
  startScheduledTask,
} from '@warka/database'
import { PostgresSchedulerLock, type SchedulerLock } from './backupScheduler.js'
import { configuredFileScanner } from './fileScannerConfig.js'
import { configuredFileStorage } from './objectFileStorage.js'
import { processPendingFileScan } from './fileScanWorkflow.js'
import { maxScheduledAttempts, retryEligible } from './schedulerRetry.js'
import type { FileScanner } from './fileScanner.js'
import type { FileStorage } from './fileStorage.js'

export function fileScanSchedulerConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  const enabled = env.WARKA_FILE_SCAN_SCHEDULER_ENABLED === 'true'
  if (
    env.WARKA_FILE_SCAN_SCHEDULER_ENABLED &&
    !['true', 'false'].includes(env.WARKA_FILE_SCAN_SCHEDULER_ENABLED)
  )
    throw new Error('Invalid file scan scheduler setting')
  const intervalMs = Number(env.WARKA_FILE_SCAN_INTERVAL_MS ?? 15000)
  if (
    !Number.isInteger(intervalMs) ||
    intervalMs < 1000 ||
    intervalMs > 3600000
  )
    throw new Error('Invalid file scan scheduler interval')
  if (enabled && !env.DATABASE_URL)
    throw new Error('File scan scheduler database is required')
  return { enabled, intervalMs, databaseUrl: env.DATABASE_URL ?? '' }
}

export class FileScanScheduler {
  private timer: ReturnType<typeof setInterval> | undefined
  private running: Promise<void> | undefined
  private stopped = false
  constructor(
    private readonly database: PrismaClient,
    private readonly config: ReturnType<typeof fileScanSchedulerConfiguration>,
    private readonly storage: FileStorage = configuredFileStorage(),
    private readonly scanner: FileScanner = configuredFileScanner(),
    private readonly lock: SchedulerLock = new PostgresSchedulerLock(
      config.databaseUrl,
    ),
  ) {}

  private async runTask(execution: { id: string; resourceId: string | null }) {
    if (!execution.resourceId) {
      await failScheduledTask(this.database, execution.id, 'SCAN_ERROR')
      return
    }
    try {
      const outcome = await processPendingFileScan({
        database: this.database,
        storage: this.storage,
        scanner: this.scanner,
        scanId: execution.resourceId,
      })
      if (outcome.status === 'failed')
        await failScheduledTask(
          this.database,
          execution.id,
          outcome.failureCode,
        )
      else
        await completeScheduledTask(
          this.database,
          execution.id,
          execution.resourceId,
        )
    } catch {
      await failScheduledTask(this.database, execution.id, 'SCAN_ERROR')
    }
  }

  private async retry(now: Date) {
    const failures = await this.database.scheduledTaskExecution.findMany({
      where: {
        taskType: 'fileScan',
        status: 'failed',
        attempt: { lt: maxScheduledAttempts },
      },
      orderBy: { completedAt: 'asc' },
      take: 25,
    })
    for (const failure of failures) {
      if (!failure.resourceId || !retryEligible(failure, now)) continue
      const later = await this.database.scheduledTaskExecution.findFirst({
        where: { seriesId: failure.seriesId, attempt: { gt: failure.attempt } },
        select: { id: true },
      })
      if (later) continue
      const reset = await this.database.fileScan.updateMany({
        where: {
          id: failure.resourceId,
          status: { in: ['failed', 'unavailable'] },
        },
        data: {
          status: 'pending',
          failureCode: null,
          startedAt: null,
          completedAt: null,
        },
      })
      if (reset.count !== 1) continue
      const execution = await startScheduledTask(
        this.database,
        'fileScan',
        'file_scan',
        now,
        failure.resourceId,
        failure.attempt + 1,
        failure.seriesId,
      )
      await this.runTask(execution)
    }
  }

  async tick(now = new Date()) {
    if (!this.config.enabled || this.stopped || this.running) return
    const work = this.lock.run(async () => {
      await this.retry(now)
      const queued = await this.database.scheduledTaskExecution.findMany({
        where: {
          taskType: 'fileScan',
          status: 'pending',
          scheduledFor: { lte: now },
        },
        orderBy: { scheduledFor: 'asc' },
        take: 10,
      })
      for (const task of queued) {
        const claimed = await this.database.scheduledTaskExecution.updateMany({
          where: { id: task.id, status: 'pending' },
          data: { status: 'running', startedAt: now },
        })
        if (claimed.count === 1) await this.runTask(task)
      }
    })
    this.running = work.then(() => undefined)
    try {
      await this.running
    } finally {
      this.running = undefined
    }
  }

  start(onError: (error: unknown) => void) {
    if (!this.config.enabled || this.timer) return
    this.stopped = false
    const poll = () => void this.tick().catch(onError)
    this.timer = setInterval(poll, this.config.intervalMs)
    this.timer.unref()
    poll()
  }
  async stop() {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    await this.running?.catch(() => undefined)
  }
}
