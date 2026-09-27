import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { checkReadiness } from './readiness.js'

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
})
