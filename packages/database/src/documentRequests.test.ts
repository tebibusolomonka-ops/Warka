import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  cancelDocumentRequest,
  createDocumentRequest,
  listStudentDocumentRequests,
} from './documentRequests.js'

const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const studentId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
const schoolId = '170e608a-d03c-41af-93cf-7db56875598b'
const academicYearId = '2efecf04-56d3-4b91-928f-f696118859c2'
function store() {
  return {
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: schoolId }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    enrollment: { findFirst: vi.fn().mockResolvedValue({ id: 'enrollment' }) },
    documentRequest: {
      create: vi.fn().mockResolvedValue({ id: 'request', status: 'requested' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        id: 'request',
        studentId,
        schoolId,
        status: 'requested',
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ id: 'request', status: 'cancelled' }),
    },
  }
}
describe('document requests', () => {
  it('lets linked students request only their enrolled year and cancel while requested', async () => {
    const database = store()
    await createDocumentRequest(database as unknown as PrismaClient, actorId, {
      schoolId,
      studentId,
      academicYearId,
      documentType: 'transcript',
    })
    expect(database.enrollment.findFirst).toHaveBeenCalledWith({
      where: {
        schoolId,
        studentId,
        academicYearId,
        status: { in: ['approved', 'withdrawn'] },
      },
      select: { id: true },
    })
    expect(database.documentRequest.create).toHaveBeenCalledWith({
      data: {
        schoolId,
        studentId,
        academicYearId,
        documentType: 'transcript',
        requestedById: actorId,
      },
    })
    await listStudentDocumentRequests(
      database as unknown as PrismaClient,
      actorId,
    )
    expect(database.documentRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId } }),
    )
    expect(
      (
        await cancelDocumentRequest(
          database as unknown as PrismaClient,
          actorId,
          '7c328107-8636-41cd-a128-ce2bd81692ed',
        )
      ).status,
    ).toBe('cancelled')
    database.documentRequest.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      cancelDocumentRequest(
        database as unknown as PrismaClient,
        actorId,
        '7c328107-8636-41cd-a128-ce2bd81692ed',
      ),
    ).rejects.toThrow('current state')
  })
  it('denies unrelated students, guardians, and unenrolled targets', async () => {
    const database = store()
    database.studentAccess.findUnique.mockResolvedValue(null)
    await expect(
      createDocumentRequest(database as unknown as PrismaClient, actorId, {
        schoolId,
        studentId,
        academicYearId,
        documentType: 'reportCard',
      }),
    ).rejects.toThrow('permission denied')
    database.studentAccess.findUnique.mockResolvedValue({ studentId })
    database.enrollment.findFirst.mockResolvedValue(null)
    await expect(
      createDocumentRequest(database as unknown as PrismaClient, actorId, {
        schoolId,
        studentId,
        academicYearId,
        documentType: 'reportCard',
      }),
    ).rejects.toThrow('permission denied')
    expect(database.documentRequest.create).not.toHaveBeenCalled()
  })
})
