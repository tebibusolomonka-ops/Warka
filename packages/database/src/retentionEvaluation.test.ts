import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { evaluateConfiguredRetentionPolicy } from './retentionPolicies.js'

describe('scheduled retention evaluation', () => {
  it('excludes active student and document holds without mutating records', async () => {
    const aggregate = vi.fn().mockResolvedValue({
      _count: 2,
      _min: { createdAt: new Date('2020-01-01') },
    })
    const database = {
      issuedDocument: { aggregate },
    } as unknown as PrismaClient
    const result = await evaluateConfiguredRetentionPolicy(
      database,
      {
        organizationId: '771ac602-fd66-4400-9116-13a79b8cc3da',
        category: 'issuedDocuments',
        retentionDays: 365,
      },
      new Date('2026-09-27'),
    )
    expect(result.eligibleCount).toBe(2)
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          retentionHolds: { none: { releasedAt: null } },
          student: {
            retentionHolds: {
              none: {
                organizationId: '771ac602-fd66-4400-9116-13a79b8cc3da',
                releasedAt: null,
              },
            },
          },
        }),
      }),
    )
  })
})
