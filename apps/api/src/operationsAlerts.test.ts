import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { sendOperationsAlert } from './operationsAlerts.js'

const userId = '3e480e62-47d7-4525-9d88-b8891e56fac0'

describe('operations alerts', () => {
  it('targets only configured active owners with neutral deduplicated messages', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = {
      organizationMembership: {
        findMany: vi.fn().mockResolvedValue([{ userId }, { userId }]),
      },
      notification: { createMany },
    } as unknown as PrismaClient
    await sendOperationsAlert(database, 'backupFailed', 'backup-id', {
      WARKA_OPERATOR_USER_IDS: userId,
    })
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId,
          type: 'operations.backupFailed',
          title: 'Backup failed',
          message: 'A database backup needs operator review.',
          resourceType: 'operationalEvent',
          resourceId: 'backup-id',
          dedupeKey: `backupFailed:backup-id:${userId}`,
        },
      ],
      skipDuplicates: true,
    })
    expect(JSON.stringify(createMany.mock.calls)).not.toContain('password')
  })
})
