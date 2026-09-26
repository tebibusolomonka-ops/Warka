import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  issueRequestedDocument,
  rejectDocumentRequest,
  startDocumentRequest,
} from './documentRequestWorkflow.js'

const mocks = vi.hoisted(() => ({
  requireDocumentAuthority: vi.fn(),
  createDocumentInTransaction: vi.fn(),
}))
vi.mock('./issuedDocuments.js', async (original) => ({
  ...(await original<typeof import('./issuedDocuments.js')>()),
  ...mocks,
}))
const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
const studentId = '170e608a-d03c-41af-93cf-7db56875598b'
const requestId = '2efecf04-56d3-4b91-928f-f696118859c2'
const yearId = '7c328107-8636-41cd-a128-ce2bd81692ed'
function store() {
  const database = {
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: schoolId }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'registrar' }),
    },
    documentRequest: {
      findFirst: vi.fn().mockResolvedValue({
        id: requestId,
        schoolId,
        studentId,
        academicYearId: yearId,
        documentType: 'transcript',
        status: 'processing',
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ id: requestId, status: 'ready' }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(
      async (work: (transaction: unknown) => Promise<unknown>) =>
        work(database),
    ),
  }
  return database
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.createDocumentInTransaction.mockResolvedValue({ id: 'issued-id' })
})
describe('document request workflow', () => {
  it('starts processing and issues only a processing request in one transaction', async () => {
    const database = store()
    await startDocumentRequest(
      database as unknown as PrismaClient,
      actorId,
      schoolId,
      requestId,
    )
    expect(database.documentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: requestId, schoolId, status: 'requested' },
      }),
    )
    await issueRequestedDocument(
      database as unknown as PrismaClient,
      actorId,
      schoolId,
      requestId,
    )
    expect(mocks.createDocumentInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      {
        schoolId,
        studentId,
        academicYearId: yearId,
        documentType: 'transcript',
      },
    )
    expect(database.documentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: requestId,
          schoolId,
          status: 'processing',
          issuedDocumentId: null,
        },
        data: expect.objectContaining({
          status: 'ready',
          issuedDocumentId: 'issued-id',
        }),
      }),
    )
    expect(database.auditEvent.create).toHaveBeenCalled()
  })
  it('rejects repeat issuance and keeps the request unchanged if document creation fails', async () => {
    const database = store()
    database.documentRequest.findFirst.mockResolvedValueOnce({
      status: 'ready',
    })
    await expect(
      issueRequestedDocument(
        database as unknown as PrismaClient,
        actorId,
        schoolId,
        requestId,
      ),
    ).rejects.toThrow('current state')
    expect(mocks.createDocumentInTransaction).not.toHaveBeenCalled()
    mocks.createDocumentInTransaction.mockRejectedValue(
      new Error('Official published results are required'),
    )
    await expect(
      issueRequestedDocument(
        database as unknown as PrismaClient,
        actorId,
        schoolId,
        requestId,
      ),
    ).rejects.toThrow('Official published')
    expect(database.documentRequest.updateMany).not.toHaveBeenCalled()
  })
  it('requires a reason for rejection and a final issuer role', async () => {
    const database = store()
    await rejectDocumentRequest(
      database as unknown as PrismaClient,
      actorId,
      schoolId,
      requestId,
      'Official source unavailable',
    )
    expect(database.documentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rejectionReason: 'Official source unavailable',
          status: 'rejected',
        }),
      }),
    )
    await expect(
      rejectDocumentRequest(
        database as unknown as PrismaClient,
        actorId,
        schoolId,
        requestId,
        'x',
      ),
    ).rejects.toThrow()
    mocks.requireDocumentAuthority.mockRejectedValueOnce(
      new Error('Document authority required'),
    )
    await expect(
      issueRequestedDocument(
        database as unknown as PrismaClient,
        actorId,
        schoolId,
        requestId,
      ),
    ).rejects.toThrow('Document authority required')
  })
})
