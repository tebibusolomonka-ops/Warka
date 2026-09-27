import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('file asset metadata in PostgreSQL', () => {
  it('stores metadata and state without file bytes', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `File asset organization ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'File asset school' },
    })
    const actor = await database!.user.create({
      data: {
        email: `file-${suffix}@example.test`,
        displayName: 'File custodian',
      },
    })
    const asset = await database!.fileAsset.create({
      data: {
        schoolId: school.id,
        ownerUserId: actor.id,
        createdById: actor.id,
        purpose: 'learningMaterial',
        originalFileName: 'lesson.pdf',
        contentType: 'application/pdf',
        sizeBytes: 12n,
        checksum: 'a'.repeat(64),
        storageKey: randomUUID(),
      },
    })
    try {
      expect(asset.status).toBe('pending')
      const available = await database!.fileAsset.update({
        where: { id: asset.id },
        data: { status: 'available' },
      })
      expect(available.status).toBe('available')
      expect(Object.keys(available)).not.toContain('bytes')
      expect(available.schoolId).toBe(school.id)
    } finally {
      await database!.fileAsset.delete({ where: { id: asset.id } })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
