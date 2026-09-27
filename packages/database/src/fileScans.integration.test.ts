import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createFileScan,
  latestFileScan,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('file scans in PostgreSQL', () => {
  it('records safe pending metadata without exposing bytes or granting availability', async () => {
    const suffix = randomUUID()
    const organization = await database!.organization.create({
      data: { name: `Scan organization ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Scan school' },
    })
    const actor = await database!.user.create({
      data: {
        email: `scan-${suffix}@example.test`,
        displayName: 'Scan uploader',
      },
    })
    const asset = await database!.fileAsset.create({
      data: {
        schoolId: school.id,
        createdById: actor.id,
        purpose: 'learningMaterial',
        originalFileName: 'lesson.pdf',
        contentType: 'application/pdf',
        sizeBytes: 12n,
        checksum: 'a'.repeat(64),
        storageKey: randomUUID(),
        scanRequired: true,
      },
    })
    try {
      const scan = await createFileScan(database!, asset.id, 'clamav')
      expect(scan.status).toBe('pending')
      expect(scan.startedAt).toBeNull()
      expect(scan.result).toBeNull()
      expect(Object.keys(scan)).not.toContain('bytes')
      expect((await latestFileScan(database!, asset.id))?.id).toBe(scan.id)
      expect(
        (
          await database!.fileAsset.findUniqueOrThrow({
            where: { id: asset.id },
          })
        ).status,
      ).toBe('pending')
      await expect(
        createFileScan(database!, asset.id, 'unsupported' as never),
      ).rejects.toThrow()
    } finally {
      await database!.fileScan.deleteMany({ where: { fileAssetId: asset.id } })
      await database!.fileAsset.delete({ where: { id: asset.id } })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
