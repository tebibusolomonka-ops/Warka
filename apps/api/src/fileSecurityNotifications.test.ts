import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { notifyFileSecurity } from './fileSecurityNotifications.js'

const teacher = '11111111-1111-4111-8111-111111111111'
const operator = '22222222-2222-4222-8222-222222222222'

describe('file security notices', () => {
  it('deduplicates teacher and active operator recipients on retry without unsafe details', async () => {
    const database = {
      organizationMembership: {
        findMany: vi.fn().mockResolvedValue([{ userId: operator }]),
      },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    } as unknown as PrismaClient
    const input = {
      event: 'quarantined' as const,
      fileAssetId: 'asset-id',
      ownerUserId: teacher,
      scanId: 'scan-id',
    }
    await notifyFileSecurity(database, input, {
      WARKA_OPERATOR_USER_IDS: operator,
    })
    await notifyFileSecurity(database, input, {
      WARKA_OPERATOR_USER_IDS: operator,
    })
    const call = vi.mocked(database.notification.createMany).mock.calls[0]?.[0]
    expect(call?.skipDuplicates).toBe(true)
    expect(call?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: teacher,
          dedupeKey: `fileSecurity:quarantined:scan-id:${teacher}`,
        }),
        expect.objectContaining({
          userId: operator,
          dedupeKey: `fileSecurity:quarantined:scan-id:${operator}`,
        }),
      ]),
    )
    expect(JSON.stringify(call)).not.toContain('storageKey')
    expect(JSON.stringify(call)).not.toContain('scanner output')
  })
  it('sends processing notice only to uploader', async () => {
    const database = {
      organizationMembership: { findMany: vi.fn() },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as PrismaClient
    await notifyFileSecurity(
      database,
      {
        event: 'processing',
        fileAssetId: 'asset-id',
        ownerUserId: teacher,
        scanId: 'scan-id',
      },
      { WARKA_OPERATOR_USER_IDS: operator },
    )
    expect(database.organizationMembership.findMany).not.toHaveBeenCalled()
    expect(
      vi.mocked(database.notification.createMany).mock.calls[0]?.[0].data,
    ).toHaveLength(1)
  })
})
