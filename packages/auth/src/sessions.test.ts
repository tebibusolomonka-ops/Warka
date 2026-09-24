import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import {
  SESSION_LIFETIME_SECONDS,
  createSession,
  hashSessionToken,
  resolveSession,
  revokeAllSessionsForUser,
  revokeSession,
} from './sessions.js'

const now = new Date('2026-09-24T10:00:00.000Z')
const user = { id: 'user-id' } as User

describe('sessions', () => {
  it('creates a random token while storing only its hash and expiration', async () => {
    const create = vi.fn().mockResolvedValue({})
    const database = { session: { create } } as unknown as PrismaClient

    const first = await createSession(database, user.id, now)
    const second = await createSession(database, user.id, now)

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second.token).not.toBe(first.token)
    expect(create.mock.calls[0]![0].data.tokenHash).toBe(
      hashSessionToken(first.token),
    )
    expect(create.mock.calls[0]![0].data.tokenHash).not.toBe(first.token)
    expect(first.expiresAt).toEqual(
      new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000),
    )
  })

  it('resolves valid sessions and rejects expired or malformed tokens', async () => {
    const findUnique = vi.fn()
    const database = { session: { findUnique } } as unknown as PrismaClient
    const token = 'a'.repeat(43)
    findUnique.mockResolvedValue({
      user,
      expiresAt: new Date(now.getTime() + 1000),
    })

    expect(await resolveSession(database, token, now)).toBe(user)
    expect(
      await resolveSession(database, token, new Date(now.getTime() + 1000)),
    ).toBeNull()
    expect(await resolveSession(database, 'invalid', now)).toBeNull()
    expect(findUnique).toHaveBeenCalledTimes(2)
  })

  it('revokes one session or all sessions for a user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = { session: { deleteMany } } as unknown as PrismaClient
    const token = 'b'.repeat(43)

    await revokeSession(database, token)
    expect(deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken(token) },
    })
    await revokeAllSessionsForUser(database, user.id)
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } })
  })
})
