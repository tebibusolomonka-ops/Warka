import { describe, expect, it, vi } from 'vitest'
import { createImportDryRun } from './importDryRuns.js'
describe('import dry runs', () => {
  it('persists only a versioned factual result tied to exact configuration', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'dry' })
    const tx = {
      importDryRun: {
        findFirst: vi.fn().mockResolvedValue({ version: 2 }),
        updateMany: vi.fn(),
        create,
      },
    }
    const database = {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    } as never
    await createImportDryRun(database, {
      importJobId: '123e4567-e89b-42d3-a456-426614174001',
      sourceProfileId: '123e4567-e89b-42d3-a456-426614174002',
      fileChecksum: 'a'.repeat(64),
      mapping: { version: 1 },
      transformations: [],
      result: {
        validRows: 1,
        invalidRows: 0,
        warnings: [],
        possibleDuplicates: [
          { rowNumber: 1, studentId: '123e4567-e89b-42d3-a456-426614174003' },
        ],
        unresolvedReferences: [],
        normalizedRows: [{ givenName: 'Hana' }],
      },
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 3,
        status: 'successful',
        mappingChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    })
    expect(tx).not.toHaveProperty('student')
  })
})
