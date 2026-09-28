import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  listVisibleCourseworkAssignments,
  mayManageCourseworkAssignment,
  visibleCourseworkAssignmentForStudent,
} from './courseworkAudience.js'

const schoolId = '00000000-0000-4000-8000-000000000001'
const yearId = '00000000-0000-4000-8000-000000000002'
const classId = '00000000-0000-4000-8000-000000000003'
const subjectId = '00000000-0000-4000-8000-000000000004'
const studentId = '00000000-0000-4000-8000-000000000005'
const actorId = '00000000-0000-4000-8000-000000000006'
const assignmentId = '00000000-0000-4000-8000-000000000007'
const assignment = {
  id: assignmentId,
  schoolId,
  academicYearId: yearId,
  schoolClassId: classId,
  subjectId,
  status: 'published',
}

function fixture({
  linked = true,
  published = true,
  eligible = true,
  teacher = true,
  assigned = true,
  expired = false,
} = {}) {
  const findAssignment = vi
    .fn()
    .mockResolvedValue(published ? assignment : null)
  const enrollment = vi
    .fn()
    .mockResolvedValue(eligible ? { id: 'enrollment' } : null)
  const findTeaching = vi
    .fn()
    .mockResolvedValue(assigned ? { id: 'teaching' } : null)
  const database = {
    studentAccess: {
      findUnique: vi.fn().mockResolvedValue(linked ? { studentId } : null),
    },
    courseworkAssignment: {
      findFirst: findAssignment,
      findMany: vi.fn().mockResolvedValue([assignment]),
    },
    enrollment: {
      findFirst: enrollment,
      findMany: vi
        .fn()
        .mockResolvedValue([
          { schoolId, academicYearId: yearId, schoolClassId: classId },
        ]),
    },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue(
        teacher
          ? {
              role: 'teacher',
              startsAt: new Date('2026-01-01'),
              endsAt: expired ? new Date('2026-02-01') : null,
            }
          : null,
      ),
    },
    teachingAssignment: { findFirst: findTeaching },
  } as unknown as PrismaClient
  return { database, findAssignment, enrollment, findTeaching }
}

describe('coursework audience', () => {
  it('shows only published work to a linked student with a current approved class enrollment', async () => {
    const { database, enrollment } = fixture()
    expect(
      await visibleCourseworkAssignmentForStudent(
        database,
        actorId,
        assignmentId,
      ),
    ).toMatchObject({ studentId, assignment })
    expect(enrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId,
          schoolId,
          academicYearId: yearId,
          schoolClassId: classId,
          status: 'approved',
          withdrawnAt: null,
        }),
      }),
    )
  })
  it('denies draft, unlinked, and departed students', async () => {
    for (const options of [
      { published: false },
      { linked: false },
      { eligible: false },
    ]) {
      const { database } = fixture(options)
      expect(
        await visibleCourseworkAssignmentForStudent(
          database,
          actorId,
          assignmentId,
        ),
      ).toBeNull()
    }
  })
  it('does not match a student enrollment in another class or school', async () => {
    for (const scope of [
      { schoolId: 'other', schoolClassId: classId },
      { schoolId, schoolClassId: 'other' },
    ]) {
      const { database, enrollment } = fixture()
      enrollment.mockImplementation(
        async ({
          where,
        }: {
          where: { schoolId: string; schoolClassId: string }
        }) =>
          where.schoolId === scope.schoolId &&
          where.schoolClassId === scope.schoolClassId
            ? { id: 'enrollment' }
            : null,
      )
      expect(
        await visibleCourseworkAssignmentForStudent(
          database,
          actorId,
          assignmentId,
        ),
      ).toBeNull()
    }
  })
  it('filters list queries to approved class and school contexts', async () => {
    const { database } = fixture()
    await listVisibleCourseworkAssignments(database, actorId)
    expect(database.courseworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'published',
          OR: [{ schoolId, academicYearId: yearId, schoolClassId: classId }],
        }),
      }),
    )
  })
  it('requires an active exact teaching assignment for teacher access', async () => {
    const denied = fixture({ assigned: false })
    expect(
      await mayManageCourseworkAssignment(denied.database, actorId, assignment),
    ).toBe(false)
    const allowed = fixture()
    expect(
      await mayManageCourseworkAssignment(
        allowed.database,
        actorId,
        assignment,
      ),
    ).toBe(true)
    expect(allowed.findTeaching).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId,
          academicYearId: yearId,
          schoolClassId: classId,
          subjectId,
        }),
      }),
    )
    const expired = fixture({ expired: true })
    expect(
      await mayManageCourseworkAssignment(
        expired.database,
        actorId,
        assignment,
      ),
    ).toBe(false)
  })
})
