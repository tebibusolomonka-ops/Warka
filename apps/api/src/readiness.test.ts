import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { checkReadiness } from './readiness.js'
import { schedulerHealth } from './schedulerHealth.js'

describe('dependency readiness', () => {
  it('reports each real dependency without exposing configuration', async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaClient
    const ready = await checkReadiness({
      database,
      env: {
        PUBLIC_BASE_URL: 'https://example.test',
        BACKUP_STORAGE_DIR: 'private',
      },
      checkPath: vi.fn().mockResolvedValue(undefined),
    })
    expect(ready).toEqual({
      status: 'ready',
      dependencies: {
        database: 'ready',
        documentRenderer: 'ready',
        backupStorage: 'ready',
      },
    })
    expect(JSON.stringify(ready)).not.toContain('private')
    const failed = await checkReadiness({
      database: {
        $queryRaw: vi.fn().mockRejectedValue(new Error('secret')),
      } as unknown as PrismaClient,
      env: {},
      checkPath: vi.fn().mockRejectedValue(new Error('secret')),
    })
    expect(failed.status).toBe('unavailable')
    expect(JSON.stringify(failed)).not.toContain('secret')
  })

  it('reports scheduler degradation through readiness without exposing details publicly', async () => {
    schedulerHealth.configure(true, 60_000)
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      scheduledTaskExecution: { count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaClient
    const result = await checkReadiness({
      database,
      env: {
        PUBLIC_BASE_URL: 'https://example.test',
        BACKUP_STORAGE_DIR: 'private',
        WARKA_BACKUP_SCHEDULER_ENABLED: 'true',
      },
      checkPath: vi.fn().mockResolvedValue(undefined),
    })
    expect(result.status).toBe('degraded')
    expect(result.scheduler?.recentFailedTaskCount).toBe(1)
    schedulerHealth.configure(false, 60_000)
  })
})
