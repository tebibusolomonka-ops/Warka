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

describe('student result history', () => {
  it('reads only the linked student�s published snapshots and current corrected values', async () => {
    const userId = randomUUID()
    const rows = [
      {
        currentPercentage: { toNumber: () => 91 },
        currentGradeLabel: 'A',
        createdAt: new Date('2026-10-01'),
        resultSet: {
          academicYear: { name: '2026' },
          gradingPeriod: { name: 'Term 1' },
          subject: { name: 'Math' },
          publishedAt: new Date('2026-10-01'),
        },
        corrections: [{ id: randomUUID() }],
      },
      {
        currentPercentage: { toNumber: () => 82 },
        currentGradeLabel: 'B',
        createdAt: new Date('2025-10-01'),
        resultSet: {
          academicYear: { name: '2025' },
          gradingPeriod: { name: 'Term 2' },
          subject: { name: 'Science' },
          publishedAt: new Date('2025-10-01'),
        },
        corrections: [],
      },
    ]
    const database = {
      studentAccess: {
        findUnique: vi.fn().mockResolvedValue({ studentId, student }),
      },
      publishedResult: { findMany: vi.fn().mockResolvedValue(rows) },
    } as unknown as PrismaClient
    const results = await prismaStudentPortalService(database).results(userId)
    expect(results).toEqual([
      {
        academicYear: '2026',
        gradingPeriod: 'Term 1',
        subject: 'Math',
        percentage: 91,
        gradeLabel: 'A',
        publishedAt: '2026-10-01T00:00:00.000Z',
        corrected: true,
      },
      {
        academicYear: '2025',
        gradingPeriod: 'Term 2',
        subject: 'Science',
        percentage: 82,
        gradeLabel: 'B',
        publishedAt: '2025-10-01T00:00:00.000Z',
        corrected: false,
      },
    ])
    expect(database.publishedResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId, resultSet: { status: 'published' } },
      }),
    )
    expect(JSON.stringify(results)).not.toContain('assessment')
  })

  it('denies an unlinked user before querying results', async () => {
    const database = {
      studentAccess: { findUnique: vi.fn().mockResolvedValue(null) },
      publishedResult: { findMany: vi.fn() },
    } as unknown as PrismaClient
    await expect(
      prismaStudentPortalService(database).results(randomUUID()),
    ).rejects.toBeInstanceOf(StudentPortalAccessError)
    expect(database.publishedResult.findMany).not.toHaveBeenCalled()
  })
})

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
