import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  prismaStudentPortalService,
  StudentPortalAccessError,
} from './studentPortalService.js'

const studentId = randomUUID()
const student = {
  id: studentId,
  studentReference: 'WKA-TEST',
  givenName: 'Hana',
  familyName: 'Bekele',
}
const current = {
  school: { name: 'Current school' },
  academicYear: { name: '2026', startsOn: new Date('2026-09-01') },
  gradeLevel: { name: 'Grade 2' },
  schoolClass: { name: 'A' },
}

describe('student portal identity', () => {
  it('requires an explicit student link even for a staff user', async () => {
    const database = {
      studentAccess: { findUnique: vi.fn().mockResolvedValue(null) },
      enrollment: { findMany: vi.fn() },
    } as unknown as PrismaClient
    const portal = prismaStudentPortalService(database)
    await expect(portal.identity(randomUUID())).rejects.toBeInstanceOf(
      StudentPortalAccessError,
    )
    expect(database.enrollment.findMany).not.toHaveBeenCalled()
  })

  it('selects only the linked student�s current approved placement', async () => {
    const userId = randomUUID()
    const database = {
      studentAccess: {
        findUnique: vi.fn().mockResolvedValue({ studentId, student }),
      },
      enrollment: { findMany: vi.fn().mockResolvedValue([current]) },
    } as unknown as PrismaClient
    const portal = prismaStudentPortalService(database)
    expect(
      await portal.identity(userId, new Date('2026-09-24T12:00:00.000Z')),
    ).toEqual({
      studentReference: student.studentReference,
      givenName: 'Hana',
      familyName: 'Bekele',
      currentEnrollment: {
        school: 'Current school',
        academicYear: '2026',
        gradeLevel: 'Grade 2',
        schoolClass: 'A',
      },
    })
    expect(database.studentAccess.findUnique).toHaveBeenCalledWith({
      where: { userId },
      include: { student: true },
    })
    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId,
          status: 'approved',
          academicYear: {
            startsOn: { lte: new Date('2026-09-24T00:00:00.000Z') },
            endsOn: { gte: new Date('2026-09-24T00:00:00.000Z') },
          },
        },
        take: 1,
      }),
    )
  })

  it('returns no current placement when only historical or withdrawn enrollments exist', async () => {
    const database = {
      studentAccess: {
        findUnique: vi.fn().mockResolvedValue({ studentId, student }),
      },
      enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient
    const portal = prismaStudentPortalService(database)
    const identity = await portal.identity(randomUUID(), new Date('2026-09-24'))
    expect(identity.currentEnrollment).toBeNull()
  })
})
