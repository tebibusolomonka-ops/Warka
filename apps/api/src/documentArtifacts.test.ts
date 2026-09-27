import { createHash, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IssuedDocument } from '@warka/database'
import { storeIssuedDocumentArtifact } from './documentManagementService.js'
import type { FileStorage } from './fileStorage.js'

const schoolId = randomUUID()
const studentId = randomUUID()
const actorId = randomUUID()
beforeEach(() => vi.stubEnv('PUBLIC_BASE_URL', 'https://warka.example.test'))

function document(
  documentType: 'reportCard' | 'transcript',
  id = randomUUID(),
) {
  return {
    id,
    schoolId,
    studentId,
    issuedById: actorId,
    documentType,
    verificationReference: 'WRK-' + 'A'.repeat(32),
    snapshot: {
      student: { displayName: 'Sample Student', studentReference: 'ST-1' },
      issuingSchool: 'Sample School',
      documentType,
      issuedAt: '2026-09-27T10:00:00.000Z',
      academicYear: '2025/26',
      subjects: [
        {
          subject: 'Math',
          gradingPeriod: 'Term 1',
          percentage: 90,
          gradeLabel: 'A',
        },
      ],
    },
  } as IssuedDocument
}

function fixture() {
  const stored = new Map<string, Uint8Array>()
  const storage: FileStorage = {
    async put(bytes) {
      const key = `asset_${randomUUID()}`
      stored.set(key, bytes)
      return { key, sizeBytes: bytes.byteLength }
    },
    async get(key) {
      const bytes = stored.get(key)
      if (!bytes) throw new Error('Missing')
      return { stream: Readable.from([bytes]), sizeBytes: bytes.byteLength }
    },
    async exists(key) {
      return stored.has(key)
    },
    async delete(key) {
      stored.delete(key)
    },
    async metadata(key) {
      return { sizeBytes: stored.get(key)?.byteLength ?? 0 }
    },
  }
  const create = vi.fn().mockResolvedValue({})
  const transaction = { fileAsset: { create } } as unknown as Parameters<
    typeof storeIssuedDocumentArtifact
  >[0]
  return { stored, storage, create, transaction }
}

describe('issued document artifacts', () => {
  it.each(['reportCard', 'transcript'] as const)(
    'stores %s PDF bytes and checksum',
    async (type) => {
      const f = fixture()
      const issued = document(type)
      const key = await storeIssuedDocumentArtifact(
        f.transaction,
        f.storage,
        issued,
      )
      const bytes = f.stored.get(key)!
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
      expect(f.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          issuedDocumentId: issued.id,
          purpose: 'issuedDocument',
          checksum: createHash('sha256').update(bytes).digest('hex'),
          sizeBytes: BigInt(bytes.byteLength),
        }),
      })
    },
  )

  it('keeps corrected versions in separate assets', async () => {
    const f = fixture()
    const first = await storeIssuedDocumentArtifact(
      f.transaction,
      f.storage,
      document('reportCard'),
    )
    const replacement = await storeIssuedDocumentArtifact(
      f.transaction,
      f.storage,
      document('reportCard'),
    )
    expect(first).not.toBe(replacement)
    expect(f.stored.size).toBe(2)
  })

  it('removes the stored bytes when asset metadata fails', async () => {
    const f = fixture()
    f.create.mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(
      storeIssuedDocumentArtifact(
        f.transaction,
        f.storage,
        document('reportCard'),
      ),
    ).rejects.toThrow('Database unavailable')
    expect(f.stored.size).toBe(0)
  })

  it('does not create an available asset if storage fails', async () => {
    const f = fixture()
    f.storage.put = vi.fn().mockRejectedValue(new Error('Storage unavailable'))
    await expect(
      storeIssuedDocumentArtifact(
        f.transaction,
        f.storage,
        document('transcript'),
      ),
    ).rejects.toThrow('Storage unavailable')
    expect(f.create).not.toHaveBeenCalled()
  })
})
