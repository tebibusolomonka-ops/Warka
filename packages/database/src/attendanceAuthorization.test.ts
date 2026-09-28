import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { mayManageAttendance } from './attendanceAuthorization.js'

const scope = {
  schoolId: 'school',
  academicYearId: 'year',
  schoolClassId: 'class',
  subjectId: 'subject',
}
const at = new Date('2026-09-28T12:00:00.000Z')

function fixture(
  role: 'administrator' | 'teacher' | 'registrar' | null,
  assigned: boolean,
) {
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      role ? { role, startsAt: new Date('2026-01-01'), endsAt: null } : null,
    )
  const findFirst = vi
    .fn()
    .mockResolvedValue(assigned ? { id: 'assignment' } : null)
  return {
    database: {
      schoolMembership: { findUnique },
      teachingAssignment: { findFirst },
    } as unknown as PrismaClient,
    findFirst,
  }
}

describe('attendance authorization', () => {
  it('requires a school role and denies registrar or unrelated staff', async () => {
    expect(
      await mayManageAttendance(
        fixture(null, true).database,
        'user',
        scope,
        at,
      ),
    ).toBe(false)
    expect(
      await mayManageAttendance(
        fixture('registrar', true).database,
        'user',
        scope,
        at,
      ),
    ).toBe(false)
  })

  it('allows school administrator and only assigned teacher', async () => {
    expect(
      await mayManageAttendance(
        fixture('administrator', false).database,
        'user',
        scope,
        at,
      ),
    ).toBe(true)
    expect(
      await mayManageAttendance(
        fixture('teacher', false).database,
        'user',
        scope,
        at,
      ),
    ).toBe(false)
    const teacher = fixture('teacher', true)
    expect(await mayManageAttendance(teacher.database, 'user', scope, at)).toBe(
      true,
    )
    expect(teacher.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: 'school',
          schoolClassId: 'class',
          subjectId: 'subject',
          userId: 'user',
        }),
      }),
    )
  })
})
