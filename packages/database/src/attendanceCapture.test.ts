import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  saveBulkAttendance,
  submitAttendanceSession,
} from './attendanceCapture.js'

const id = '00000000-0000-4000-8000-000000000001'
const studentId = '00000000-0000-4000-8000-000000000002'
const enrollmentId = '00000000-0000-4000-8000-000000000003'
const session = {
  id,
  status: 'open',
  schoolId: id,
  academicYearId: id,
  schoolClassId: id,
  date: new Date('2026-09-28'),
}

function fixture(records: { studentId: string }[] = []) {
  const upsert = vi.fn().mockResolvedValue({})
  const update = vi.fn().mockResolvedValue({ ...session, status: 'submitted' })
  const transaction = {
    attendanceSession: {
      findUnique: vi.fn().mockResolvedValue(session),
      update,
    },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue({
        role: 'administrator',
        startsAt: new Date('2026-01-01'),
        endsAt: null,
      }),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([{ studentId, id: enrollmentId }]),
    },
    studentAttendanceRecord: {
      upsert,
      findMany: vi.fn().mockResolvedValue(records),
    },
  }
  const database = {
    $transaction: vi.fn(
      (run: (client: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    ),
  } as unknown as PrismaClient
  return { database, upsert, update }
}

describe('bulk attendance capture', () => {
  it('rejects duplicate students and wrong enrollment', async () => {
    const fixtureValue = fixture()
    const mark = { studentId, enrollmentId, status: 'present' as const }
    await expect(
      saveBulkAttendance(fixtureValue.database, id, {
        sessionId: id,
        marks: [mark, mark],
      }),
    ).rejects.toThrow('Duplicate')
    await expect(
      saveBulkAttendance(fixtureValue.database, id, {
        sessionId: id,
        marks: [{ ...mark, enrollmentId: id }],
      }),
    ).rejects.toThrow('Eligible enrollment')
    expect(fixtureValue.upsert).not.toHaveBeenCalled()
  })

  it('saves explicit marks and refuses submission while a student is unrecorded', async () => {
    const fixtureValue = fixture()
    await saveBulkAttendance(fixtureValue.database, id, {
      sessionId: id,
      marks: [{ studentId, enrollmentId, status: 'late' }],
    })
    expect(fixtureValue.upsert).toHaveBeenCalledOnce()
    await expect(
      submitAttendanceSession(fixtureValue.database, id, id),
    ).rejects.toThrow('Unrecorded')
    expect(fixtureValue.update).not.toHaveBeenCalled()
    expect(
      (await submitAttendanceSession(fixture([{ studentId }]).database, id, id))
        .status,
    ).toBe('submitted')
  })
})
