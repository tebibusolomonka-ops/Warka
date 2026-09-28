import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  eligibleCourseworkEnrollment,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import { findStudentAccessForUser } from './studentAccess.js'
import {
  AssignmentExtensionError,
  effectiveCourseworkDueAt,
  grantAssignmentExtension,
} from './assignmentExtensions.js'

vi.mock('./courseworkAudience.js', () => ({
  eligibleCourseworkEnrollment: vi.fn(),
  mayManageCourseworkAssignment: vi.fn(),
}))
vi.mock('./studentAccess.js', () => ({ findStudentAccessForUser: vi.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const dueAt = new Date('2026-11-01')
const now = new Date('2026-09-01')
function fixture() {
  const database = {
    courseworkAssignment: {
      findFirst: vi.fn().mockResolvedValue({ id, schoolId: id, dueAt }),
    },
    assignmentExtension: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id }),
    },
  } as unknown as PrismaClient
  return database
}
beforeEach(() => {
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(true)
  vi.mocked(eligibleCourseworkEnrollment)
    .mockReset()
    .mockResolvedValue({ id } as never)
  vi.mocked(findStudentAccessForUser).mockReset().mockResolvedValue(null)
})
describe('assignment extensions', () => {
  it('preserves global due date and creates a historical student-specific extension', async () => {
    const database = fixture()
    await grantAssignmentExtension(
      database,
      id,
      id,
      id,
      {
        studentId: id,
        extendedDueAt: '2026-11-05T00:00:00.000Z',
        reason: 'Approved accommodation',
      },
      now,
    )
    expect(database.assignmentExtension.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalDueAt: dueAt,
        extendedDueAt: new Date('2026-11-05T00:00:00.000Z'),
        studentId: id,
      }),
    })
    expect(database.courseworkAssignment.update).toBeUndefined()
  })
  it('denies cross-school staff, student self-grants, and ineligible students', async () => {
    const database = fixture()
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(false)
    await expect(
      grantAssignmentExtension(
        database,
        id,
        id,
        id,
        {
          studentId: id,
          extendedDueAt: '2026-11-05T00:00:00.000Z',
          reason: 'Reason',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(AssignmentExtensionError)
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(true)
    vi.mocked(findStudentAccessForUser).mockResolvedValue({
      studentId: id,
    } as never)
    await expect(
      grantAssignmentExtension(
        database,
        id,
        id,
        id,
        {
          studentId: id,
          extendedDueAt: '2026-11-05T00:00:00.000Z',
          reason: 'Reason',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(AssignmentExtensionError)
    vi.mocked(findStudentAccessForUser).mockResolvedValue(null)
    vi.mocked(eligibleCourseworkEnrollment).mockResolvedValue(null)
    await expect(
      grantAssignmentExtension(
        database,
        id,
        id,
        id,
        {
          studentId: id,
          extendedDueAt: '2026-11-05T00:00:00.000Z',
          reason: 'Reason',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(AssignmentExtensionError)
  })
  it('uses the latest personal due time without changing the assignment', async () => {
    const database = fixture()
    vi.mocked(database.assignmentExtension.findFirst).mockResolvedValue({
      extendedDueAt: new Date('2026-11-07'),
    } as never)
    await expect(
      effectiveCourseworkDueAt(database, { id, dueAt }, id),
    ).resolves.toEqual(new Date('2026-11-07'))
  })
})
