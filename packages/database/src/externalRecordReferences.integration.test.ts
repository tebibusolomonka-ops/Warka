import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createExternalRecordReference } from './externalRecordReferences.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('external record references in PostgreSQL', () => {
  it('enforces source, entity type, and external id uniqueness without replacing Warka ids', async () => {
    const actor = await database!.user.create({
      data: {
        email: `external-${crypto.randomUUID()}@example.com`,
        displayName: 'External reference actor',
      },
    })
    const entityId = crypto.randomUUID()
    try {
      const student = await createExternalRecordReference(database!, actor.id, {
        sourceSystem: 'sis-a',
        externalId: '42',
        entityType: 'student',
        entityId,
      })
      const staff = await createExternalRecordReference(database!, actor.id, {
        sourceSystem: 'sis-a',
        externalId: '42',
        entityType: 'staff',
        entityId: crypto.randomUUID(),
      })
      expect(student.entityId).toBe(entityId)
      expect(staff.entityType).toBe('staff')
      await expect(
        createExternalRecordReference(database!, actor.id, {
          sourceSystem: 'sis-a',
          externalId: '42',
          entityType: 'student',
          entityId: crypto.randomUUID(),
        }),
      ).rejects.toThrow()
    } finally {
      await database!.externalRecordReference.deleteMany({
        where: { createdById: actor.id },
      })
      await database!.user.delete({ where: { id: actor.id } })
    }
  })
})
