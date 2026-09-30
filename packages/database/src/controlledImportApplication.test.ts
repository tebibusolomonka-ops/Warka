import { describe, expect, it, vi } from 'vitest'
import { applyValidatedImport } from './controlledImportApplication.js'
describe('controlled import application', () => {
  it('rejects changed inputs before opening an application transaction', async () => {
    const transaction = vi.fn()
    const database = {
      importDryRun: {
        findUnique: vi.fn().mockResolvedValue({
          id: '123e4567-e89b-42d3-a456-426614174001',
          status: 'successful',
          fileChecksum: 'a'.repeat(64),
          mappingChecksum: 'different',
          transformChecksum: 'different',
          importJob: { schoolId: '123e4567-e89b-42d3-a456-426614174002' },
        }),
      },
      school: {
        findUnique: vi.fn().mockResolvedValue({
          organizationId: '123e4567-e89b-42d3-a456-426614174003',
        }),
      },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({ role: 'owner' }),
      },
      schoolMembership: {
        findUnique: vi.fn().mockResolvedValue({ role: 'registrar' }),
      },
      $transaction: transaction,
    } as never
    await expect(
      applyValidatedImport(database, '123e4567-e89b-42d3-a456-426614174004', {
        dryRunId: '123e4567-e89b-42d3-a456-426614174001',
        fileChecksum: 'a'.repeat(64),
        mapping: {},
        transformations: [],
      }),
    ).rejects.toThrow('changed')
    expect(transaction).not.toHaveBeenCalled()
  })
  it('rejects an already applied version', async () => {
    const database = {
      importDryRun: {
        findUnique: vi.fn().mockResolvedValue({ status: 'applied' }),
      },
    } as never
    await expect(
      applyValidatedImport(database, '123e4567-e89b-42d3-a456-426614174004', {
        dryRunId: '123e4567-e89b-42d3-a456-426614174001',
        fileChecksum: 'a'.repeat(64),
        mapping: {},
        transformations: [],
      }),
    ).rejects.toThrow('successful')
  })
})
