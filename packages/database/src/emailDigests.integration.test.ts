import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createEmailDigest, listEmailDigests } from './emailDigests.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('email digest records in PostgreSQL', () => {
  it('deduplicates one user and window without copying notification bodies', async () => {
    const user = await database!.user.create({
      data: {
        email: `digest-${randomUUID()}@example.test`,
        displayName: 'Digest User',
      },
    })
    const windowStartAt = new Date('2026-09-26T00:00:00Z')
    const windowEndAt = new Date('2026-09-27T00:00:00Z')
    try {
      const input = {
        userId: user.id,
        windowStartAt,
        windowEndAt,
        itemCount: 2,
      }
      const first = await createEmailDigest(database!, input)
      const second = await createEmailDigest(database!, input)
      expect(second.id).toBe(first.id)
      expect((await listEmailDigests(database!, user.id))[0]?.itemCount).toBe(2)
      expect(JSON.stringify(first)).not.toContain('message')
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
