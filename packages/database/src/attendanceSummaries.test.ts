import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { getAttendanceSummary } from './attendanceSummaries.js'

const id = '00000000-0000-4000-8000-000000000001'
const studentA = '00000000-0000-4000-8000-000000000002'
const studentB = '00000000-0000-4000-8000-000000000003'

describe('attendance summaries', () => {
  it('counts explicit statuses and separates unrecorded from absent', async () => {
    const database = {
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { schoolClassId: id, studentId: studentA },
          { schoolClassId: id, studentId: studentB },
        ]),
      },
      attendanceSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id,
            schoolClassId: id,
            status: 'open',
            records: [{ studentId: studentA, status: 'present' }],
          },
          {
            id: studentA,
            schoolClassId: id,
            status: 'submitted',
            records: [
              { studentId: studentA, status: 'late' },
              { studentId: studentB, status: 'absent' },
            ],
          },
        ]),
      },
    } as unknown as PrismaClient
    expect(
      await getAttendanceSummary(database, {
        schoolId: id,
        academicYearId: id,
      }),
    ).toEqual({
      instructionalSessionsRecorded: 1,
      incompleteSessions: 1,
      present: 1,
      absent: 1,
      late: 1,
      excused: 0,
      unrecorded: 1,
    })
  })
})
