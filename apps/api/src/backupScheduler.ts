import { Client } from 'pg'
import type { PrismaClient } from '@warka/database'
import {
  backupDue,
  startScheduledTask,
  completeScheduledTask,
  failScheduledTask,
  evaluateConfiguredRetentionPolicy,
} from '@warka/database'
import { executeBackup, LocalBackupStorage } from './backupService.js'
import { verifyBackup } from './backupVerification.js'
import { sendOperationsAlert } from './operationsAlerts.js'
import { requireOperator } from './operationsAccess.js'
import { cleanupBackupArtifacts } from './backupRetention.js'
import { maxScheduledAttempts, retryEligible } from './schedulerRetry.js'
import { schedulerHealth } from './schedulerHealth.js'

const lockKey = 8_246_181

export type SchedulerConfiguration = {
  enabled: boolean
  backupEnabled: boolean
  intervalMs: number
  actorId: string
  databaseUrl: string
  storageDirectory: string
  retentionEvaluationEnabled: boolean
}

export function schedulerConfiguration(
  env: NodeJS.ProcessEnv,
): SchedulerConfiguration {
  const backupEnabled = env.WARKA_BACKUP_SCHEDULER_ENABLED === 'true'
  const retentionEvaluationEnabled =
    env.WARKA_RETENTION_EVALUATION_ENABLED === 'true'
  const enabled = backupEnabled || retentionEvaluationEnabled
  if (
    env.WARKA_BACKUP_SCHEDULER_ENABLED &&
    !['true', 'false'].includes(env.WARKA_BACKUP_SCHEDULER_ENABLED)
  )
    throw new Error('Invalid backup scheduler enabled setting')
  if (
    env.WARKA_RETENTION_EVALUATION_ENABLED &&
    !['true', 'false'].includes(env.WARKA_RETENTION_EVALUATION_ENABLED)
  )
    throw new Error('Invalid retention evaluation setting')
  const intervalMs = Number(env.WARKA_BACKUP_SCHEDULER_INTERVAL_MS ?? 60_000)
  if (
    !Number.isInteger(intervalMs) ||
    intervalMs < 10_000 ||
    intervalMs > 3_600_000
  )
    throw new Error('Invalid backup scheduler polling interval')
  const actorId = env.WARKA_SCHEDULER_ACTOR_ID ?? ''
  const databaseUrl = env.DATABASE_URL ?? ''
  const storageDirectory = env.BACKUP_STORAGE_DIR ?? ''
  if (
    enabled &&
    (!/^[\da-f-]{36}$/i.test(actorId) || !databaseUrl || !storageDirectory)
  )
    throw new Error('Incomplete backup scheduler configuration')
  return {
    enabled,
    backupEnabled,
    intervalMs,
    actorId,
    databaseUrl,
    storageDirectory,
    retentionEvaluationEnabled,
  }
}

export interface SchedulerLock {
  run<T>(work: () => Promise<T>): Promise<T | undefined>
}

export class PostgresSchedulerLock implements SchedulerLock {
  constructor(private readonly databaseUrl: string) {}

  async run<T>(work: () => Promise<T>): Promise<T | undefined> {
    const client = new Client({ connectionString: this.databaseUrl })
    await client.connect()
    let acquired = false
    try {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [lockKey],
      )
      acquired = result.rows[0]?.acquired === true
      if (!acquired) return undefined
      return await work()
    } finally {
      if (acquired) {
        await client
          .query('SELECT pg_advisory_unlock($1)', [lockKey])
          .catch(() => undefined)
      }
      await client.end()
    }
  }
}

export class BackupScheduler {
  private timer: ReturnType<typeof setInterval> | undefined
  private running: Promise<void> | undefined
  private stopped = false

  constructor(
    private readonly database: PrismaClient,
    private readonly config: SchedulerConfiguration,
    private readonly lock: SchedulerLock = new PostgresSchedulerLock(
      config.databaseUrl,
    ),
    private readonly backup: typeof executeBackup = executeBackup,
    private readonly verify: typeof verifyBackup = verifyBackup,
    private readonly evaluateRetention: typeof evaluateConfiguredRetentionPolicy = evaluateConfiguredRetentionPolicy,
  ) {}

  private async runBackupTask(now: Date, attempt = 1, seriesId?: string) {
    const execution = await startScheduledTask(
      this.database,
      'backup',
      'database',
      now,
      undefined,
      attempt,
      seriesId,
    )
    try {
      const recordId = await schedulerHealth.track(() =>
        this.backup({
          database: this.database,
          actorId: this.config.actorId,
          databaseUrl: this.config.databaseUrl,
          storage: new LocalBackupStorage(this.config.storageDirectory),
        }),
      )
      await completeScheduledTask(this.database, execution.id, recordId)
    } catch {
      await failScheduledTask(this.database, execution.id, 'BACKUP_FAILED')
      if (attempt >= maxScheduledAttempts)
        await sendOperationsAlert(
          this.database,
          'backupFailed',
          execution.seriesId,
        ).catch(() => undefined)
      throw new Error('Scheduled backup failed')
    }
  }

  private async runRetentionTask(
    policy: {
      id: string
      organizationId: string
      category:
        | 'messages'
        | 'auditEvents'
        | 'issuedDocuments'
        | 'academicRecords'
        | 'enrollmentRecords'
      retentionDays: number
    },
    now: Date,
    attempt = 1,
    seriesId?: string,
  ) {
    const execution = await startScheduledTask(
      this.database,
      'retentionEvaluation',
      policy.organizationId,
      now,
      policy.id,
      attempt,
      seriesId,
    )
    try {
      const result = await schedulerHealth.track(() =>
        this.evaluateRetention(this.database, policy, now),
      )
      await completeScheduledTask(this.database, execution.id, policy.id, {
        eligibleCount: result.eligibleCount,
        oldestEligibleAt: result.oldestEligibleAt,
      })
    } catch {
      await failScheduledTask(
        this.database,
        execution.id,
        'RETENTION_EVALUATION_FAILED',
      )
    }
  }

  private async retryFailedTasks(now: Date) {
    const failures = await this.database.scheduledTaskExecution.findMany({
      where: { status: 'failed', attempt: { lt: maxScheduledAttempts } },
      orderBy: { completedAt: 'asc' },
      take: 25,
    })
    for (const failure of failures) {
      if (retryEligible(failure, now)) await this.retryOne(failure, now)
    }
  }

  private async retryOne(
    failure: {
      seriesId: string
      attempt: number
      taskType: string
      resourceId: string | null
    },
    now: Date,
  ) {
    const later = await this.database.scheduledTaskExecution.findFirst({
      where: { seriesId: failure.seriesId, attempt: { gt: failure.attempt } },
      select: { id: true },
    })
    if (later) return false
    if (failure.taskType === 'backup' && this.config.backupEnabled) {
      await requireOperator(this.database, this.config.actorId)
      await this.runBackupTask(
        now,
        failure.attempt + 1,
        failure.seriesId,
      ).catch(() => undefined)
      return true
    }
    if (
      failure.taskType === 'retentionEvaluation' &&
      this.config.retentionEvaluationEnabled
    ) {
      const policy = await this.database.retentionPolicy.findUnique({
        where: { id: failure.resourceId ?? '' },
        select: {
          id: true,
          organizationId: true,
          category: true,
          retentionDays: true,
        },
      })
      if (!policy) return false
      await requireOperator(this.database, this.config.actorId)
      await this.runRetentionTask(
        policy,
        now,
        failure.attempt + 1,
        failure.seriesId,
      )
      return true
    }
    return false
  }

  async retryExecution(id: string, now = new Date()) {
    const result = await this.lock.run(async () => {
      const failure = await this.database.scheduledTaskExecution.findUnique({
        where: { id },
      })
      if (!failure || !retryEligible(failure, now)) return false
      return this.retryOne(failure, now)
    })
    return result === true
  }

  private async evaluateRetentionPolicies(now: Date) {
    if (!this.config.retentionEvaluationEnabled) return
    await requireOperator(this.database, this.config.actorId)
    const policies = await this.database.retentionPolicy.findMany({
      select: {
        id: true,
        organizationId: true,
        category: true,
        retentionDays: true,
      },
    })
    for (const policy of policies) {
      const latest = await this.database.scheduledTaskExecution.findFirst({
        where: {
          taskType: 'retentionEvaluation',
          scope: policy.organizationId,
          resourceId: policy.id,
        },
        orderBy: { scheduledFor: 'desc' },
        select: { scheduledFor: true },
      })
      if (latest && now.getTime() - latest.scheduledFor.getTime() < 86_400_000)
        continue
      await this.runRetentionTask(policy, now)
    }
  }

  async tick(now = new Date()) {
    if (!this.config.enabled || this.stopped || this.running) return
    schedulerHealth.polled(now)
    const work = this.lock.run(async () => {
      await this.retryFailedTasks(now)
      await this.evaluateRetentionPolicies(now)
      if (!this.config.backupEnabled) return
      const policy = await this.database.backupPolicy.findUnique({
        where: { id: 'database' },
      })
      if (!policy?.enabled) return
      await requireOperator(this.database, this.config.actorId)
      const latest = await this.database.backupRecord.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (backupDue(policy, latest?.createdAt ?? null, now)) {
        await this.runBackupTask(now)
      }
      if (policy.verificationRequired) {
        const pending = await this.database.backupRecord.findMany({
          where: { status: 'completed', verificationResult: null },
          orderBy: { completedAt: 'asc' },
          take: 10,
          select: { id: true },
        })
        for (const record of pending) {
          const execution = await startScheduledTask(
            this.database,
            'backupVerification',
            'database',
            now,
            record.id,
          )
          try {
            await schedulerHealth.track(async () => {
              const passed = await this.verify({
                database: this.database,
                id: record.id,
                storage: new LocalBackupStorage(this.config.storageDirectory),
              })
              if (!passed) throw new Error('Backup verification failed')
            })
            await completeScheduledTask(this.database, execution.id, record.id)
          } catch {
            await failScheduledTask(
              this.database,
              execution.id,
              'VERIFICATION_FAILED',
            )
            await sendOperationsAlert(
              this.database,
              'verificationFailed',
              record.id,
            ).catch(() => undefined)
          }
        }
      }
      await cleanupBackupArtifacts({
        database: this.database,
        storage: new LocalBackupStorage(this.config.storageDirectory),
        actorId: this.config.actorId,
      })
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
    schedulerHealth.configure(this.config.enabled, this.config.intervalMs)
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
    schedulerHealth.configure(false, this.config.intervalMs)
  }
}
