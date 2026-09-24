import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createUser,
  findPasswordHashForUser,
} from '@warka/database'
import { bootstrapOwner, BootstrapConflictError } from './bootstrapOwner.js'
import { setPassword, verifyPassword } from './passwords.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('password persistence and owner bootstrap', () => {
  it('stores and replaces a password hash for a user', async () => {
    const user = await createUser(database!, {
      email: `credential-${randomUUID()}@example.test`,
      displayName: 'Credential test',
    })

    try {
      await setPassword(database!, user.id, 'first long password')
      const first = await findPasswordHashForUser(database!, user.id)
      expect(first).toMatch(/^\$argon2id\$/)
      expect(await verifyPassword('first long password', first)).toBe(true)

      await setPassword(database!, user.id, 'second long password')
      const second = await findPasswordHashForUser(database!, user.id)
      expect(second).not.toBe(first)
      expect(await verifyPassword('first long password', second)).toBe(false)
      expect(await verifyPassword('second long password', second)).toBe(true)
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })

  it('bootstraps an owner atomically and rejects conflicting records', async () => {
    const input = {
      email: `owner-${randomUUID()}@example.test`,
      displayName: 'Owner test',
      password: 'owner long password',
      organizationName: `Owner office ${randomUUID()}`,
    }
    const { user, organization } = await bootstrapOwner(database!, input)

    try {
      const membership = await database!.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organization.id,
          },
        },
      })
      expect(membership?.role).toBe('owner')
      expect(
        await verifyPassword(
          input.password,
          await findPasswordHashForUser(database!, user.id),
        ),
      ).toBe(true)
      await expect(bootstrapOwner(database!, input)).rejects.toBeInstanceOf(
        BootstrapConflictError,
      )
      expect(
        await database!.organization.count({
          where: { name: input.organizationName },
        }),
      ).toBe(1)
    } finally {
      await database!.organizationMembership.delete({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organization.id,
          },
        },
      })
      await database!.organization.delete({ where: { id: organization.id } })
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
