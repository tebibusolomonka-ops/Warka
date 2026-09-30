import { describe, expect, it, vi } from 'vitest'
import {
  generateStudentTransferExchange,
  validateExchangeFiles,
} from './exchangePackages.js'
describe('Warka exchange packages', () => {
  it('creates a versioned manifest with checksums from transfer-approved fields', async () => {
    const database = {
      school: {
        findUnique: vi.fn().mockResolvedValue({ organizationId: 'org' }),
      },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({ role: 'owner' }),
      },
      schoolMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: 'administrator',
          startsAt: new Date('2020-01-01'),
          endsAt: null,
        }),
      },
      transferRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'transfer',
          status: 'approvedBySendingSchool',
          transferPackage: {
            student: { displayName: 'Hana', studentReference: 'WKA-1' },
          },
        }),
      },
    } as never
    const result = await generateStudentTransferExchange(
      database,
      '123e4567-e89b-42d3-a456-426614174001',
      '123e4567-e89b-42d3-a456-426614174002',
      '123e4567-e89b-42d3-a456-426614174003',
    )
    expect(result.manifest).toMatchObject({
      format: 'warkaExchangePackage',
      version: '1.0',
      exportPurpose: 'studentTransferPackage',
    })
    expect(result.manifest.files[0]?.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(result)).not.toMatch(
      /password|session|recovery|supportCase|familyMessage/i,
    )
  })
  it('rejects traversal, absolute paths, and resource excess', () => {
    expect(() => validateExchangeFiles({ '../secret': 'x' })).toThrow()
    expect(() => validateExchangeFiles({ '/secret': 'x' })).toThrow()
    expect(() => validateExchangeFiles({ 'C:secret': 'x' })).toThrow()
    expect(() => validateExchangeFiles({ 'safe.json': '1234' }, 1, 2)).toThrow(
      'size',
    )
  })
})
