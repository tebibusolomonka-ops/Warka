import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { hashPassword } from '@warka/auth'
import type { PrismaClient, User } from '@warka/database'
import { createAuthService } from './authService.js'

describe('authentication service', () => {
  it('verifies credentials and resolves a persisted session', async () => {
    const user = {
      id: randomUUID(),
      email: 'owner@example.test',
      displayName: 'Owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies User
    const passwordHash = await hashPassword('correct password')
    const sessions = new Map<string, { user: User; expiresAt: Date }>()
    const database = {
      user: {
        findUnique: vi
          .fn()
          .mockImplementation(async ({ where }) =>
            where.email === user.email ? user : null,
          ),
      },
      passwordCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash }),
      },
      session: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          sessions.set(data.tokenHash, { user, expiresAt: data.expiresAt })
          return { id: randomUUID(), ...data }
        }),
        findUnique: vi
          .fn()
          .mockImplementation(
            async ({ where }) => sessions.get(where.tokenHash) ?? null,
          ),
        deleteMany: vi.fn().mockImplementation(async ({ where }) => {
          sessions.delete(where.tokenHash)
          return { count: 1 }
        }),
      },
    } as unknown as PrismaClient
    const auth = createAuthService(database)

    const login = await auth.login(user.email, 'correct password')
    expect(login?.user).toEqual(user)
    expect(login?.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await auth.currentUser(login!.token)).toEqual(user)
    expect(await auth.login(user.email, 'wrong password')).toBeNull()
    expect(
      await auth.login('unknown@example.test', 'correct password'),
    ).toBeNull()

    await auth.logout(login!.token)
    expect(await auth.currentUser(login!.token)).toBeNull()
  })
})

describe('password changes', () => {
  it('checks the authenticated session, clears the first-login flag, and revokes other sessions', async () => {
    const user = {
      id: randomUUID(),
      email: 'student@example.test',
      displayName: 'Student',
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies User
    let passwordHash = await hashPassword('initial password')
    let mustChangePassword = true
    const sessions = new Map<string, { user: User; expiresAt: Date }>()
    const database = {
      passwordCredential: {
        findUnique: vi.fn().mockImplementation(async () => ({
          passwordHash,
          mustChangePassword,
        })),
        update: vi.fn().mockImplementation(async ({ data }) => {
          passwordHash = data.passwordHash
          mustChangePassword = data.mustChangePassword
          return {}
        }),
      },
      session: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          sessions.set(data.tokenHash, { user, expiresAt: data.expiresAt })
          return { id: randomUUID(), ...data }
        }),
        findUnique: vi
          .fn()
          .mockImplementation(
            async ({ where }) => sessions.get(where.tokenHash) ?? null,
          ),
        deleteMany: vi.fn().mockImplementation(async ({ where }) => {
          for (const key of sessions.keys())
            if (where.tokenHash?.not !== key) sessions.delete(key)
          return { count: 1 }
        }),
      },
      $transaction: vi
        .fn()
        .mockImplementation(async (items) => Promise.all(items)),
    } as unknown as PrismaClient
    const auth = createAuthService(database)
    const first = await (
      await import('@warka/auth')
    ).createSession(database, user.id)
    const other = await (
      await import('@warka/auth')
    ).createSession(database, user.id)
    expect(await auth.passwordState!(first.token)).toBe(true)
    expect(
      await auth.changePassword!(
        first.token,
        'wrong password',
        'new long password',
      ),
    ).toBe('invalid-current')
    await expect(
      auth.changePassword!(first.token, 'initial password', 'short'),
    ).rejects.toThrow()
    expect(
      await auth.changePassword!(
        first.token,
        'initial password',
        'new long password',
      ),
    ).toBe('changed')
    expect(await auth.passwordState!(first.token)).toBe(false)
    expect(await auth.currentUser(first.token)).toEqual(user)
    expect(await auth.currentUser(other.token)).toBeNull()
    expect(
      await auth.changePassword!(
        other.token,
        'new long password',
        'another long password',
      ),
    ).toBe('unauthenticated')
  })
})
