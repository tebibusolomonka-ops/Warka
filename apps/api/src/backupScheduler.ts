import { Client } from 'pg'
import type { PrismaClient } from '@warka/database'
import {
  backupDue,
  startScheduledTask,
  completeScheduledTask,
  failScheduledTask,
} from '@warka/database'
import { executeBackup, LocalBackupStorage } from './backupService.js'
import { sendOperationsAlert } from './operationsAlerts.js'
import { requireOperator } from './operationsAccess.js'

const lockKey = 8_246_181

export type SchedulerConfiguration = {
  enabled: boolean
  intervalMs: number
  actorId: string
  databaseUrl: string
  storageDirectory: string
}

export function schedulerConfiguration(
  env: NodeJS.ProcessEnv,
): SchedulerConfiguration {
  const enabled = env.WARKA_BACKUP_SCHEDULER_ENABLED === 'true'
  if (
    env.WARKA_BACKUP_SCHEDULER_ENABLED &&
    !['true', 'false'].includes(env.WARKA_BACKUP_SCHEDULER_ENABLED)
  )
    throw new Error('Invalid backup scheduler enabled setting')
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
  return { enabled, intervalMs, actorId, databaseUrl, storageDirectory }
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
  ) {}

  async tick(now = new Date()) {
    if (!this.config.enabled || this.stopped || this.running) return
    const work = this.lock.run(async () => {
      const policy = await this.database.backupPolicy.findUnique({
        where: { id: 'database' },
      })
      if (!policy?.enabled) return
      const latest = await this.database.backupRecord.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (!backupDue(policy, latest?.createdAt ?? null, now)) return
      await requireOperator(this.database, this.config.actorId)
      const execution = await startScheduledTask(
        this.database,
        'backup',
        'database',
        now,
      )
      try {
        const recordId = await this.backup({
          database: this.database,
          actorId: this.config.actorId,
          databaseUrl: this.config.databaseUrl,
          storage: new LocalBackupStorage(this.config.storageDirectory),
          onFailure: (recordId) =>
            sendOperationsAlert(this.database, 'backupFailed', recordId).then(
              () => undefined,
            ),
        })
        await completeScheduledTask(this.database, execution.id, recordId)
      } catch {
        await failScheduledTask(this.database, execution.id, 'BACKUP_FAILED')
        throw new Error('Scheduled backup failed')
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
