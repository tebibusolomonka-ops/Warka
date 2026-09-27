import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import type { evaluateConfiguredRetentionPolicy } from '@warka/database'
import type { executeBackup } from './backupService.js'
import type { verifyBackup } from './backupVerification.js'
import {
  BackupScheduler,
  schedulerConfiguration,
  type SchedulerConfiguration,
  type SchedulerLock,
} from './backupScheduler.js'

vi.mock('./operationsAccess.js', () => ({
  requireOperator: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./backupRetention.js', () => ({
  cleanupBackupArtifacts: vi
    .fn()
    .mockResolvedValue({ deleted: [], failed: [] }),
}))

const now = new Date('2026-09-27T12:00:00Z')
const config: SchedulerConfiguration = {
  enabled: true,
  backupEnabled: true,
  intervalMs: 10_000,
  actorId: '717ac602-fd66-4400-9116-13a79b8cc3da',
  databaseUrl: 'postgresql://localhost/warka',
  storageDirectory: 'test-storage',
  retentionEvaluationEnabled: false,
}

function fixture(policyEnabled = true, latest?: Date) {
  const backup = vi.fn().mockResolvedValue('backup-id')
  const database = {
    backupPolicy: {
      findUnique: vi.fn().mockResolvedValue({
        enabled: policyEnabled,
        frequency: 'daily',
        retentionCount: 7,
        verificationRequired: true,
      }),
    },
    backupRecord: {
      findFirst: vi
        .fn()
        .mockResolvedValue(latest ? { createdAt: latest } : null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    scheduledTaskExecution: {
      create: vi.fn().mockResolvedValue({ id: 'execution-id' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient
  const lock: SchedulerLock = { run: async (work) => work() }
  const scheduler = new BackupScheduler(
    database,
    config,
    lock,
    backup as unknown as typeof executeBackup,
  )
  return { backup, scheduler, database }
}

describe('backup scheduler', () => {
  it('executes a due policy', async () => {
    const { backup, scheduler } = fixture(true, new Date('2026-09-25'))
    await scheduler.tick(now)
    expect(backup).toHaveBeenCalledOnce()
    expect(backup).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: config.actorId }),
    )
  })

  it('ignores not-due and disabled policies', async () => {
    const recent = fixture(true, new Date('2026-09-27T11:00:00Z'))
    const disabled = fixture(false)
    await recent.scheduler.tick(now)
    await disabled.scheduler.tick(now)
    expect(recent.backup).not.toHaveBeenCalled()
    expect(disabled.backup).not.toHaveBeenCalled()
  })

  it('prevents duplicate concurrent execution', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const backup = vi.fn().mockImplementation(() => pending)
    const database = {
      backupPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ enabled: true, frequency: 'daily' }),
      },
      backupRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      scheduledTaskExecution: {
        create: vi.fn().mockResolvedValue({ id: 'execution-id' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient
    const scheduler = new BackupScheduler(
      database,
      config,
      { run: async (work) => work() },
      backup as unknown as typeof executeBackup,
    )
    const first = scheduler.tick(now)
    await scheduler.tick(now)
    release()
    await first
    expect(backup).toHaveBeenCalledOnce()
  })

  it('waits for running work on shutdown', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const backup = vi.fn().mockImplementation(() => pending)
    const database = {
      backupPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ enabled: true, frequency: 'daily' }),
      },
      backupRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      scheduledTaskExecution: {
        create: vi.fn().mockResolvedValue({ id: 'execution-id' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient
    const scheduler = new BackupScheduler(
      database,
      config,
      { run: async (work) => work() },
      backup as unknown as typeof executeBackup,
    )
    const tick = scheduler.tick(now)
    const stop = scheduler.stop()
    release()
    await Promise.all([tick, stop])
    await scheduler.tick(now)
    expect(backup).toHaveBeenCalledOnce()
  })

  it('reports a failed backup without swallowing the failure', async () => {
    const { database } = fixture()
    const backup = vi
      .fn()
      .mockRejectedValue(new Error('Backup execution failed'))
    const failed = new BackupScheduler(
      database,
      config,
      { run: async (work) => work() },
      backup as unknown as typeof executeBackup,
    )
    await expect(failed.tick(now)).rejects.toThrow('Scheduled backup failed')
  })

  it('does not execute when another instance holds the database lock', async () => {
    const { database } = fixture()
    const backup = vi.fn()
    const scheduler = new BackupScheduler(
      database,
      config,
      { run: async () => undefined },
      backup as unknown as typeof executeBackup,
    )
    await scheduler.tick(now)
    expect(backup).not.toHaveBeenCalled()
  })

  it('verifies completed unverified artifacts and records the outcome', async () => {
    const { database } = fixture(true, now)
    const findMany = vi.fn().mockResolvedValue([{ id: 'backup-record' }])
    ;(
      database as unknown as { backupRecord: { findMany: typeof findMany } }
    ).backupRecord.findMany = findMany
    const verify = vi.fn().mockResolvedValue(true)
    const scheduler = new BackupScheduler(
      database,
      config,
      { run: async (work) => work() },
      vi.fn() as unknown as typeof executeBackup,
      verify as unknown as typeof verifyBackup,
    )
    await scheduler.tick(now)
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'backup-record' }),
    )
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'completed', verificationResult: null },
      }),
    )
    expect(database.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    )
  })

  it('records verification failure without deleting the artifact', async () => {
    const { database } = fixture(true, now)
    ;(
      database as unknown as {
        backupRecord: { findMany: ReturnType<typeof vi.fn> }
      }
    ).backupRecord.findMany.mockResolvedValue([{ id: 'failed-backup' }])
    const verify = vi.fn().mockResolvedValue(false)
    const scheduler = new BackupScheduler(
      database,
      config,
      { run: async (work) => work() },
      vi.fn() as unknown as typeof executeBackup,
      verify as unknown as typeof verifyBackup,
    )
    await scheduler.tick(now)
    expect(database.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          failureCode: 'VERIFICATION_FAILED',
        }),
      }),
    )
  })

  it('validates opt-in configuration', () => {
    expect(schedulerConfiguration({}).enabled).toBe(false)
    expect(() =>
      schedulerConfiguration({ WARKA_BACKUP_SCHEDULER_ENABLED: 'true' }),
    ).toThrow()
    expect(() =>
      schedulerConfiguration({ WARKA_BACKUP_SCHEDULER_INTERVAL_MS: '1' }),
    ).toThrow()
  })

  it('evaluates configured retention policies without destructive mutations', async () => {
    const { database } = fixture()
    const policy = {
      id: 'retention-policy',
      organizationId: '771ac602-fd66-4400-9116-13a79b8cc3da',
      category: 'issuedDocuments' as const,
      retentionDays: 365,
    }
    const raw = database as unknown as {
      retentionPolicy: { findMany: ReturnType<typeof vi.fn> }
      scheduledTaskExecution: {
        findFirst: ReturnType<typeof vi.fn>
        updateMany: ReturnType<typeof vi.fn>
      }
    }
    raw.retentionPolicy = { findMany: vi.fn().mockResolvedValue([policy]) }
    raw.scheduledTaskExecution.findFirst = vi.fn().mockResolvedValue(null)
    const evaluate = vi.fn().mockResolvedValue({
      eligibleCount: 3,
      oldestEligibleAt: new Date('2020-01-01'),
    })
    const scheduler = new BackupScheduler(
      database,
      { ...config, backupEnabled: false, retentionEvaluationEnabled: true },
      { run: async (work) => work() },
      vi.fn() as unknown as typeof executeBackup,
      vi.fn() as unknown as typeof verifyBackup,
      evaluate as unknown as typeof evaluateConfiguredRetentionPolicy,
    )
    await scheduler.tick(now)
    expect(evaluate).toHaveBeenCalledWith(database, policy, now)
    expect(raw.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eligibleCount: 3,
          status: 'completed',
        }),
      }),
    )
    expect(database.backupRecord.findFirst).not.toHaveBeenCalled()
  })

  it('skips retention work when no policy exists or the task is disabled', async () => {
    const { database } = fixture()
    const raw = database as unknown as {
      retentionPolicy: { findMany: ReturnType<typeof vi.fn> }
    }
    raw.retentionPolicy = { findMany: vi.fn().mockResolvedValue([]) }
    const noPolicy = new BackupScheduler(
      database,
      { ...config, backupEnabled: false, retentionEvaluationEnabled: true },
      { run: async (work) => work() },
    )
    await noPolicy.tick(now)
    expect(database.scheduledTaskExecution.create).not.toHaveBeenCalled()
    const disabled = new BackupScheduler(
      database,
      {
        ...config,
        enabled: false,
        backupEnabled: false,
        retentionEvaluationEnabled: false,
      },
      { run: async (work) => work() },
    )
    await disabled.tick(now)
    expect(raw.retentionPolicy.findMany).toHaveBeenCalledOnce()
  })

  it('retries a failed backup once after backoff and preserves its series', async () => {
    const { database, backup, scheduler } = fixture(true, now)
    const tasks = database.scheduledTaskExecution as unknown as {
      findMany: ReturnType<typeof vi.fn>
      findFirst: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
    }
    tasks.findMany.mockResolvedValue([
      {
        id: 'first-attempt',
        seriesId: 'retry-series',
        taskType: 'backup',
        status: 'failed',
        attempt: 1,
        failureCode: 'BACKUP_FAILED',
        completedAt: new Date(now.getTime() - 61_000),
      },
    ])
    tasks.findFirst = vi.fn().mockResolvedValue(null)
    await scheduler.tick(now)
    expect(backup).toHaveBeenCalledOnce()
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempt: 2, seriesId: 'retry-series' }),
      }),
    )
  })

  it('does not duplicate a retry that already has a later attempt', async () => {
    const { database, backup, scheduler } = fixture(true, now)
    const tasks = database.scheduledTaskExecution as unknown as {
      findMany: ReturnType<typeof vi.fn>
      findFirst: ReturnType<typeof vi.fn>
    }
    tasks.findMany.mockResolvedValue([
      {
        seriesId: 'retry-series',
        taskType: 'backup',
        status: 'failed',
        attempt: 1,
        failureCode: 'BACKUP_FAILED',
        completedAt: new Date(now.getTime() - 61_000),
      },
    ])
    tasks.findFirst = vi.fn().mockResolvedValue({ id: 'later-attempt' })
    await scheduler.tick(now)
    expect(backup).not.toHaveBeenCalled()
  })
})
