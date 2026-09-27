import type { PrismaClient } from '@warka/database'
import { completeScheduledTask, failScheduledTask } from '@warka/database'
import { PostgresSchedulerLock, type SchedulerLock } from './backupScheduler.js'
import type { EmailProvider } from './emailProvider.js'
import { processQueuedEmailDelivery } from './emailOutbox.js'
import { SmtpEmailProvider, smtpConfiguration } from './smtpEmailProvider.js'
import { retryDelayMs } from './schedulerRetry.js'
import { sendOperationsAlert } from './operationsAlerts.js'
import { routePendingNotificationEmails } from './notificationEmailRouting.js'

export const maxEmailDeliveryAttempts = 3

export function emailRetryEligible(
  task: {
    status: string
    attempt: number
    failureCode: string | null
    completedAt: Date | null
  },
  now = new Date(),
) {
  return (
    task.status === 'failed' &&
    task.attempt < maxEmailDeliveryAttempts &&
    task.failureCode === 'UNAVAILABLE' &&
    !!task.completedAt &&
    now.getTime() - task.completedAt.getTime() >= retryDelayMs(task.attempt)
  )
}

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
  if (flag === 'true') {
    if (!env.WARKA_RECOVERY_TOKEN_KEY || !env.WARKA_PUBLIC_APP_URL)
      throw new Error('Email recovery configuration is required')
    if (Buffer.from(env.WARKA_RECOVERY_TOKEN_KEY, 'base64url').length !== 32)
      throw new Error('Invalid recovery token key')
    const url = new URL(env.WARKA_PUBLIC_APP_URL)
    if (
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid public application URL')
  }
  return {
    enabled: flag === 'true',
    intervalMs,
    databaseUrl: env.DATABASE_URL ?? '',
    recovery: {
      tokenKey: env.WARKA_RECOVERY_TOKEN_KEY ?? '',
      publicAppUrl: env.WARKA_PUBLIC_APP_URL ?? '',
    },
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

  private async runTask(task: {
    id: string
    resourceId: string | null
    attempt: number
  }) {
    if (!task.resourceId) {
      await failScheduledTask(this.database, task.id, 'DELIVERY_ERROR')
      return
    }
    try {
      const outcome = await processQueuedEmailDelivery(
        this.database,
        this.provider,
        task.resourceId,
        new Date(),
        this.config.recovery,
      )
      if (outcome.status === 'failed') {
        await failScheduledTask(this.database, task.id, outcome.failureCode)
        if (!outcome.retryable || task.attempt >= maxEmailDeliveryAttempts)
          await sendOperationsAlert(
            this.database,
            'emailDeliveryFailed',
            task.resourceId,
          ).catch(() => undefined)
      } else
        await completeScheduledTask(this.database, task.id, task.resourceId)
    } catch {
      await failScheduledTask(this.database, task.id, 'DELIVERY_ERROR')
    }
  }

  private async retry(now: Date) {
    const failures = await this.database.scheduledTaskExecution.findMany({
      where: {
        taskType: 'emailDelivery',
        status: 'failed',
        attempt: { lt: maxEmailDeliveryAttempts },
        failureCode: 'UNAVAILABLE',
      },
      orderBy: { completedAt: 'asc' },
      take: 25,
    })
    for (const failure of failures) {
      if (!failure.resourceId || !emailRetryEligible(failure, now)) continue
      await this.database.$transaction(async (transaction) => {
        const later = await transaction.scheduledTaskExecution.findFirst({
          where: {
            seriesId: failure.seriesId,
            attempt: { gt: failure.attempt },
          },
          select: { id: true },
        })
        if (later) return
        const reset = await transaction.emailDelivery.updateMany({
          where: {
            id: failure.resourceId!,
            status: 'failed',
            failureCode: 'UNAVAILABLE',
            attemptCount: failure.attempt,
          },
          data: {
            status: 'queued',
            scheduledAt: now,
            failureCode: null,
            failedAt: null,
          },
        })
        if (reset.count !== 1) return
        await transaction.scheduledTaskExecution.create({
          data: {
            taskType: 'emailDelivery',
            scope: 'transactional_email',
            resourceId: failure.resourceId,
            scheduledFor: now,
            status: 'pending',
            seriesId: failure.seriesId,
            attempt: failure.attempt + 1,
          },
        })
      })
    }
  }

  async tick(now = new Date()) {
    if (!this.config.enabled || this.stopped || this.running) return
    const work = this.lock.run(async () => {
      await routePendingNotificationEmails(this.database, now)
      await this.retry(now)
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
