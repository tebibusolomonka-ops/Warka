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
