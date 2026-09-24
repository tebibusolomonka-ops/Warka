import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createUser,
  DuplicateEmailError,
  findUserByEmail,
  findUserById,
} from './users.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('user repository', () => {
  it('creates and finds a normalized user, rejecting duplicate email', async () => {
    const email = `member-${randomUUID()}@example.test`
    const created = await createUser(database!, {
      email: email.toUpperCase(),
      displayName: '  Test member  ',
    })

    try {
      expect(created.email).toBe(email)
      expect(created.displayName).toBe('Test member')
      expect(await findUserById(database!, created.id)).toEqual(created)
      expect(await findUserByEmail(database!, email.toUpperCase())).toEqual(
        created,
      )
      await expect(
        createUser(database!, { email, displayName: 'Duplicate' }),
      ).rejects.toBeInstanceOf(DuplicateEmailError)
    } finally {
      await database!.user.delete({ where: { id: created.id } })
    }
  })
})
