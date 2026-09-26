import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  clearFailedLogins,
  isLoginThrottled,
  loginEmailHash,
  recordFailedLogin,
} from './loginAttempts.js'

describe('login attempt protection', () => {
  it('uses hashed normalized email, bounds failures, resets success, and expires its window', async () => {
    const rows = new Map<
      string,
      { failures: number; windowStartsAt: Date; blockedUntil: Date | null }
    >()
    const store = {
      findUnique: vi.fn(
        async ({ where }: { where: { emailHash: string } }) =>
          rows.get(where.emailHash) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { emailHash: string }
          create: { failures: number; windowStartsAt: Date }
          update: { failures: number; windowStartsAt: Date; blockedUntil: null }
        }) => {
          rows.set(
            where.emailHash,
            rows.has(where.emailHash)
              ? update
              : { ...create, blockedUntil: null },
          )
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { emailHash: string }
          data: { failures: { increment: number }; blockedUntil?: Date }
        }) => {
          const row = rows.get(where.emailHash)!
          row.failures += data.failures.increment
          if (data.blockedUntil) row.blockedUntil = data.blockedUntil
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { emailHash: string } }) => {
        rows.delete(where.emailHash)
      }),
    }
    const database = { loginAttemptBucket: store } as unknown as PrismaClient
    const now = new Date('2026-09-26T10:00:00Z')
    expect(loginEmailHash(' User@Example.test ')).toBe(
      loginEmailHash('user@example.test'),
    )
    expect(loginEmailHash('user@example.test')).not.toContain('user')
    expect(await isLoginThrottled(database, 'unknown@example.test', now)).toBe(
      false,
    )
    for (let i = 0; i < 8; i++)
      await recordFailedLogin(database, 'user@example.test', now)
    expect(await isLoginThrottled(database, 'user@example.test', now)).toBe(
      true,
    )
    expect(
      await isLoginThrottled(
        database,
        'user@example.test',
        new Date(now.getTime() + 5 * 60_000),
      ),
    ).toBe(false)
    await clearFailedLogins(database, 'user@example.test')
    expect(await isLoginThrottled(database, 'user@example.test', now)).toBe(
      false,
    )
    await recordFailedLogin(database, 'unknown@example.test', now)
    expect(rows.get(loginEmailHash('unknown@example.test'))?.failures).toBe(1)
  })
})
