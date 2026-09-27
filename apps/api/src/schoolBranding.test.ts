import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import type { FileStorage } from './fileStorage.js'
import { removeSchoolLogo, uploadSchoolLogo } from './schoolBranding.js'

vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  requireSchoolDocumentProfileManager: vi.fn().mockResolvedValue(undefined),
}))

const logo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1cAAAAASUVORK5CYII=',
  'base64',
)
const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'

function fixture() {
  const transaction = {
    fileAsset: {
      create: vi.fn().mockResolvedValue({
        id: 'asset-id',
        originalFileName: 'logo.png',
        sizeBytes: BigInt(logo.length),
      }),
    },
    schoolDocumentProfile: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ logoAssetId: 'old-asset' }),
      update: vi.fn().mockResolvedValue({}),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  }
  const database = {
    $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) =>
      work(transaction),
  } as unknown as PrismaClient
  const storage = {
    put: vi.fn().mockResolvedValue({
      key: 'asset_11111111-1111-4111-8111-111111111111',
      sizeBytes: logo.length,
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as FileStorage
  return { database, storage, transaction }
}

describe('school logo management', () => {
  it('replaces only the current logo reference and preserves prior asset history', async () => {
    const { database, storage, transaction } = fixture()
    const result = await uploadSchoolLogo({
      database,
      storage,
      actorId,
      schoolId,
      bytes: logo,
      originalFileName: 'logo.png',
      claimedContentType: 'image/png',
    })
    expect(result.id).toBe('asset-id')
    expect(transaction.schoolDocumentProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { logoAssetId: 'asset-id' } }),
    )
    expect(storage.delete).not.toHaveBeenCalled()
    expect(transaction.auditEvent.create).toHaveBeenCalled()
  })

  it('removes only the active logo reference', async () => {
    const { database, transaction } = fixture()
    expect(await removeSchoolLogo(database, actorId, schoolId)).toEqual({
      removed: true,
    })
    expect(transaction.schoolDocumentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { logoAssetId: null } }),
    )
    expect(transaction.fileAsset.create).not.toHaveBeenCalled()
  })

  it('rejects SVG and cleans stored bytes when metadata persistence fails', async () => {
    const { database, storage, transaction } = fixture()
    await expect(
      uploadSchoolLogo({
        database,
        storage,
        actorId,
        schoolId,
        bytes: Buffer.from('<svg/>'),
        originalFileName: 'logo.svg',
        claimedContentType: 'image/svg+xml',
      }),
    ).rejects.toThrow()
    expect(storage.put).not.toHaveBeenCalled()
    transaction.fileAsset.create.mockRejectedValueOnce(
      new Error('database unavailable'),
    )
    await expect(
      uploadSchoolLogo({
        database,
        storage,
        actorId,
        schoolId,
        bytes: logo,
        originalFileName: 'logo.png',
        claimedContentType: 'image/png',
      }),
    ).rejects.toThrow('could not be recorded')
    expect(storage.delete).toHaveBeenCalledOnce()
  })
})
