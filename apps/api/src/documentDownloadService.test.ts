import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  DocumentDownloadDeniedError,
  prismaDocumentDownloadService,
} from './documentDownloadService.js'

const schoolId = randomUUID()
const documentId = randomUUID()
const ownerId = randomUUID()
const otherId = randomUUID()
const staffId = randomUUID()
const document = {
  id: documentId,
  schoolId,
  studentId: randomUUID(),
  documentType: 'reportCard',
}
const database = (staffRole: string | null = null) =>
  ({
    issuedDocument: {
      findFirst: vi.fn(async ({ where }: { where: { schoolId: string } }) =>
        where.schoolId === schoolId ? document : null,
      ),
    },
    studentAccess: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === ownerId ? { studentId: document.studentId } : null,
      ),
    },
    schoolMembership: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { userId_schoolId: { userId: string; schoolId: string } }
        }) =>
          where.userId_schoolId.userId === staffId &&
          where.userId_schoolId.schoolId === schoolId &&
          staffRole
            ? { role: staffRole }
            : null,
      ),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  }) as unknown as PrismaClient

describe('document download authorization', () => {
  it('allows the linked student but denies another student and guardian', async () => {
    const service = prismaDocumentDownloadService(database())
    expect((await service.find(ownerId, schoolId, documentId)).id).toBe(
      documentId,
    )
    await expect(
      service.find(otherId, schoolId, documentId),
    ).rejects.toBeInstanceOf(DocumentDownloadDeniedError)
  })
  it('allows authorized school staff and denies unrelated school staff and bureau users', async () => {
    const service = prismaDocumentDownloadService(database('registrar'))
    expect((await service.find(staffId, schoolId, documentId)).id).toBe(
      documentId,
    )
    await expect(
      service.find(staffId, randomUUID(), documentId),
    ).rejects.toBeInstanceOf(DocumentDownloadDeniedError)
    await expect(
      service.find(otherId, schoolId, documentId),
    ).rejects.toBeInstanceOf(DocumentDownloadDeniedError)
  })
})
