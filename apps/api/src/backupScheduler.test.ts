import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
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

const now = new Date('2026-09-27T12:00:00Z')
const config: SchedulerConfiguration = {
  enabled: true,
  intervalMs: 10_000,
  actorId: '717ac602-fd66-4400-9116-13a79b8cc3da',
  databaseUrl: 'postgresql://localhost/warka',
  storageDirectory: 'test-storage',
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
})
