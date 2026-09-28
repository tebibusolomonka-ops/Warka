import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { correctAttendance } from './attendanceCorrections.js'

const id = '00000000-0000-4000-8000-000000000001'
const input = {
  recordId: id,
  newStatus: 'excused' as const,
  reason: 'Verified correction',
}

function fixture(
  role: 'administrator' | 'teacher',
  status: 'submitted' | 'finalized',
) {
  const create = vi
    .fn()
    .mockResolvedValue({ id, previousStatus: 'absent', newStatus: 'excused' })
  const audit = vi.fn().mockResolvedValue({})
  const update = vi.fn().mockResolvedValue({})
  const transaction = {
    studentAttendanceRecord: {
      findUnique: vi.fn().mockResolvedValue({
        id,
        schoolId: id,
        status: 'absent',
        session: {
          schoolId: id,
          academicYearId: id,
          schoolClassId: id,
          date: new Date('2026-09-28'),
          status,
        },
      }),
      update,
    },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue({
        role,
        startsAt: new Date('2026-01-01'),
        endsAt: null,
      }),
    },
    teachingAssignment: { findFirst: vi.fn().mockResolvedValue({ id }) },
    attendanceCorrection: { create },
    auditEvent: { create: audit },
  }
  const database = {
    $transaction: vi.fn(
      (run: (client: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    ),
  } as unknown as PrismaClient
  return { database, create, audit, update }
}

describe('attendance corrections', () => {
  it('preserves previous status for submitted teacher correction', async () => {
    const value = fixture('teacher', 'submitted')
    await correctAttendance(value.database, id, input)
    expect(value.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousStatus: 'absent',
        newStatus: 'excused',
        approvedById: null,
      }),
    })
    expect(value.audit).not.toHaveBeenCalled()
  })

  it('requires administrator and audits finalized correction', async () => {
    const teacher = fixture('teacher', 'finalized')
    await expect(
      correctAttendance(teacher.database, id, input),
    ).rejects.toThrow('cannot manage')
    expect(teacher.update).not.toHaveBeenCalled()
    const admin = fixture('administrator', 'finalized')
    await correctAttendance(admin.database, id, input)
    expect(admin.audit).toHaveBeenCalledOnce()
  })
})
