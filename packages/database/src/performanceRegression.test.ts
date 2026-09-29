import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { getAttendanceRoster } from './attendanceCapture.js'
import { listNotifications } from './notifications.js'

const id = '123e4567-e89b-42d3-a456-426614174001'

describe('bounded read query structure', () => {
  it('loads a notification page with one list query rather than one query per item', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 20 }, (_, index) => ({ id: `${index}` })),
      )
    const database = {
      notification: { findMany },
      notificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient
    await listNotifications(database, id, { take: 20 })
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('loads attendance students and records in two bulk queries', async () => {
    const enrollments = Array.from({ length: 100 }, (_, index) => ({
      id: `enrollment-${index}`,
      studentId: `student-${index}`,
      student: { givenName: 'Synthetic', familyName: `${index}` },
    }))
    const enrollmentFindMany = vi.fn().mockResolvedValue(enrollments)
    const recordFindMany = vi.fn().mockResolvedValue([])
    const database = {
      attendanceSession: {
        findUnique: vi.fn().mockResolvedValue({
          id,
          schoolId: id,
          academicYearId: id,
          schoolClassId: id,
          teachingAssignmentId: id,
          date: new Date('2026-09-30T00:00:00.000Z'),
          status: 'open',
        }),
      },
      schoolMembership: {
        findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
      },
      enrollment: { findMany: enrollmentFindMany },
      studentAttendanceRecord: { findMany: recordFindMany },
    } as unknown as PrismaClient
    const result = await getAttendanceRoster(database, id, id)
    expect(result.enrollments).toHaveLength(100)
    expect(enrollmentFindMany).toHaveBeenCalledTimes(1)
    expect(recordFindMany).toHaveBeenCalledTimes(1)
  })
})
