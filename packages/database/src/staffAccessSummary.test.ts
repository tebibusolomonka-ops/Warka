import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  listStaffAccess,
  StaffAccessPermissionError,
} from './staffAccessSummary.js'

const schoolId = randomUUID()
const organizationId = randomUUID()
const actorId = randomUUID()
const staffId = randomUUID()
const past = new Date('2026-01-01')
const now = new Date('2026-09-27')
const future = new Date('2027-01-01')

function fixture(role: string | null = 'administrator') {
  return {
    school: { findUnique: vi.fn().mockResolvedValue({ organizationId }) },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([
        {
          id: staffId,
          email: 'staff@example.test',
          displayName: 'Staff',
          accountStatus: 'suspended',
          organizationMemberships: [],
          schoolMemberships: [
            { role: 'teacher', startsAt: past, endsAt: null },
          ],
          teachingAssignments: [
            {
              id: randomUUID(),
              academicYearId: randomUUID(),
              schoolClassId: randomUUID(),
              subjectId: randomUUID(),
              startsAt: future,
              endsAt: null,
            },
          ],
        },
      ]),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue(
        role
          ? {
              role,
              startsAt: past,
              endsAt: null,
            }
          : null,
      ),
    },
  } as unknown as PrismaClient
}

describe('staff access summary', () => {
  it('returns only safe fields and distinguishes account and assignment states', async () => {
    const database = fixture()
    const result = await listStaffAccess(
      database,
      actorId,
      schoolId,
      { take: 10, skip: 0 },
      now,
    )
    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: staffId,
      accountStatus: 'suspended',
      schoolMembership: { role: 'teacher', periodStatus: 'active' },
      teachingAssignments: [{ periodStatus: 'future' }],
    })
    expect(JSON.stringify(result)).not.toMatch(/password|token|credential/i)
    expect(database.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 0 }),
    )
  })

  it('denies an ordinary teacher and unrelated account', async () => {
    await expect(
      listStaffAccess(fixture('teacher'), actorId, schoolId),
    ).rejects.toBeInstanceOf(StaffAccessPermissionError)
    await expect(
      listStaffAccess(fixture(null), actorId, schoolId),
    ).rejects.toBeInstanceOf(StaffAccessPermissionError)
  })
})
