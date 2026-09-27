import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { searchDocumentsAndTransfers } from './documentTransferSearch.js'
import { SearchAccessError } from './schoolSearch.js'

const actorId = '11111111-1111-4111-8111-111111111111'
const schoolId = '22222222-2222-4222-8222-222222222222'
function store(role = 'administrator') {
  return {
    school: {
      findUnique: vi.fn().mockResolvedValue({
        organizationId: '33333333-3333-4333-8333-333333333333',
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role, startsAt: new Date(0), endsAt: null }),
    },
    issuedDocument: {
      findMany: vi.fn().mockResolvedValue([
        {
          verificationReference: 'WRK-DOC-1',
          documentType: 'transcript',
          status: 'active',
          student: { studentReference: 'WRK-STU-1' },
        },
      ]),
    },
    documentRequest: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'request-id',
          documentType: 'transcript',
          status: 'requested',
          student: { studentReference: 'WRK-STU-1' },
        },
      ]),
    },
    transferRequest: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'transfer-id',
          status: 'requested',
          student: { studentReference: 'WRK-STU-1' },
        },
      ]),
    },
  } as unknown as PrismaClient
}
const input = {
  actorId,
  schoolId,
  query: 'WRK-STU-1',
  types: [
    'issuedDocument' as const,
    'documentRequest' as const,
    'transfer' as const,
  ],
  limit: 10,
  offset: 0,
}
describe('document and transfer search', () => {
  it('returns safe summaries and scopes documents, requests, and both transfer directions', async () => {
    const database = store()
    const results = await searchDocumentsAndTransfers(database, input)
    expect(results.map((item) => item.type)).toEqual([
      'issuedDocument',
      'documentRequest',
      'transfer',
    ])
    expect(results[0]?.reference).toBe('WRK-DOC-1')
    expect(database.issuedDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId }) }),
    )
    expect(database.documentRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId }) }),
    )
    expect(database.transferRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            {
              OR: [
                { sendingSchoolId: schoolId },
                { receivingSchoolId: schoolId },
              ],
            },
          ]),
        },
      }),
    )
    expect(JSON.stringify(results)).not.toContain('snapshot')
  })
  it('denies a registrar issued-document search before any private query', async () => {
    const database = store('registrar')
    await expect(
      searchDocumentsAndTransfers(database, input),
    ).rejects.toBeInstanceOf(SearchAccessError)
    expect(database.issuedDocument.findMany).not.toHaveBeenCalled()
  })
})
