import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { recordAuditEvent, type PrismaClient } from '@warka/database'
import { FakeFileScanner, type ScanOutcome } from './fileScanner.js'
import { processPendingFileScan } from './fileScanWorkflow.js'
import type { FileStorage } from './fileStorage.js'

vi.mock('@warka/database', async (original) => ({
  ...(await original<typeof import('@warka/database')>()),
  recordAuditEvent: vi.fn(),
}))

function fixture(outcome: ScanOutcome, claimed = 1) {
  const assetId = randomUUID()
  const scanId = randomUUID()
  const scan = {
    id: scanId,
    fileAssetId: assetId,
    status: 'pending',
    fileAsset: {
      id: assetId,
      status: 'pending',
      scanRequired: true,
      storageKey: `asset_${randomUUID()}`,
      schoolId: randomUUID(),
      createdById: randomUUID(),
    },
  }
  const updateScan = vi.fn().mockResolvedValue({})
  const updateAsset = vi.fn().mockResolvedValue({ count: 1 })
  const database = {
    fileScan: {
      findUnique: vi.fn().mockResolvedValue(scan),
      updateMany: vi.fn().mockResolvedValue({ count: claimed }),
      update: updateScan,
    },
    fileAsset: { updateMany: updateAsset },
    $transaction: vi.fn(async (run) => run(database)),
  } as unknown as PrismaClient
  const storage = {
    get: vi
      .fn()
      .mockResolvedValue({
        stream: Readable.from([Buffer.from('synthetic')]),
        sizeBytes: 9,
      }),
  } as unknown as FileStorage
  const scanner = new FakeFileScanner([outcome])
  return { database, storage, scanner, scanId, updateScan, updateAsset }
}

describe('file quarantine lifecycle', () => {
  it.each([
    [{ status: 'clean' }, 'clean', 'available'],
    [{ status: 'infected' }, 'infected', 'quarantined'],
    [
      { status: 'failed', failureCode: 'SCANNER_UNAVAILABLE' },
      'unavailable',
      'pending',
    ],
    [{ status: 'failed', failureCode: 'SCAN_ERROR' }, 'failed', 'pending'],
  ] as const)(
    'records %j and keeps asset %s/%s',
    async (outcome, scanStatus, assetStatus) => {
      const f = fixture(outcome)
      expect(await processPendingFileScan(f)).toEqual(outcome)
      expect(f.updateScan).toHaveBeenCalledWith({
        where: { id: f.scanId },
        data: expect.objectContaining({ status: scanStatus }),
      })
      expect(f.updateAsset).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: 'pending' }),
        data: { status: assetStatus },
      })
      expect(recordAuditEvent).toHaveBeenCalledTimes(
        outcome.status === 'infected' ? 1 : 0,
      )
      vi.mocked(recordAuditEvent).mockClear()
    },
  )

  it('does not process a scan another worker claimed', async () => {
    const f = fixture({ status: 'clean' }, 0)
    expect(await processPendingFileScan(f)).toEqual({ status: 'skipped' })
    expect(f.storage.get).not.toHaveBeenCalled()
    expect(f.updateAsset).not.toHaveBeenCalled()
  })

  it('keeps an asset pending when storage cannot be read', async () => {
    const f = fixture({ status: 'clean' })
    vi.mocked(f.storage.get).mockRejectedValue(new Error('storage offline'))
    expect(await processPendingFileScan(f)).toEqual({
      status: 'failed',
      failureCode: 'SCAN_ERROR',
    })
    expect(f.updateAsset).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'pending' } }),
    )
  })
})
