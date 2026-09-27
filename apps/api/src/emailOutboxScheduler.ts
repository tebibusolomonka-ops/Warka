import type { PrismaClient } from '@warka/database'
import { completeScheduledTask, failScheduledTask } from '@warka/database'
import { PostgresSchedulerLock, type SchedulerLock } from './backupScheduler.js'
import type { EmailProvider } from './emailProvider.js'
import { processQueuedEmailDelivery } from './emailOutbox.js'
import { SmtpEmailProvider, smtpConfiguration } from './smtpEmailProvider.js'

export function emailOutboxConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const flag = env.WARKA_EMAIL_OUTBOX_ENABLED ?? 'false'
  if (flag !== 'true' && flag !== 'false')
    throw new Error('Invalid email outbox setting')
  const intervalMs = Number(env.WARKA_EMAIL_OUTBOX_INTERVAL_MS ?? 15000)
  if (
    !Number.isInteger(intervalMs) ||
    intervalMs < 1000 ||
    intervalMs > 3600000
  )
    throw new Error('Invalid email outbox interval')
  if (flag === 'true' && !env.DATABASE_URL)
    throw new Error('Email outbox database is required')
  return {
    enabled: flag === 'true',
    intervalMs,
    databaseUrl: env.DATABASE_URL ?? '',
  }
}

export function configuredEmailProvider(
  env: NodeJS.ProcessEnv = process.env,
): EmailProvider {
  return new SmtpEmailProvider(smtpConfiguration(env))
}

export class EmailOutboxScheduler {
  private timer: ReturnType<typeof setInterval> | undefined
  private running: Promise<void> | undefined
  private stopped = false

  constructor(
    private readonly database: PrismaClient,
    private readonly config: ReturnType<typeof emailOutboxConfiguration>,
    private readonly provider: EmailProvider = configuredEmailProvider(),
    private readonly lock: SchedulerLock = new PostgresSchedulerLock(
      config.databaseUrl,
    ),
  ) {}

  private async runTask(task: { id: string; resourceId: string | null }) {
    if (!task.resourceId) {
      await failScheduledTask(this.database, task.id, 'DELIVERY_ERROR')
      return
    }
    try {
      const outcome = await processQueuedEmailDelivery(
        this.database,
        this.provider,
        task.resourceId,
      )
      if (outcome.status === 'failed')
        await failScheduledTask(this.database, task.id, outcome.failureCode)
      else await completeScheduledTask(this.database, task.id, task.resourceId)
    } catch {
      await failScheduledTask(this.database, task.id, 'DELIVERY_ERROR')
    }
  }

  async tick(now = new Date()) {
    if (!this.config.enabled || this.stopped || this.running) return
    const work = this.lock.run(async () => {
      const queued = await this.database.scheduledTaskExecution.findMany({
        where: {
          taskType: 'emailDelivery',
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
