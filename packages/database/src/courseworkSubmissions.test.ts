import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  visibleCourseworkAssignmentForStudent,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import {
  CourseworkSubmissionAccessError,
  startCourseworkSubmission,
  ownCourseworkSubmission,
  listCourseworkSubmissionsForStaff,
} from './courseworkSubmissions.js'

vi.mock('./courseworkAudience.js', () => ({
  visibleCourseworkAssignmentForStudent: vi.fn(),
  mayManageCourseworkAssignment: vi.fn(),
}))
vi.mock('./assignmentExtensions.js', () => ({
  effectiveCourseworkDueAt: vi.fn().mockResolvedValue(new Date('2026-12-01')),
}))
const id = '00000000-0000-4000-8000-000000000001'
function fixture() {
  const database = {
    courseworkSubmission: {
      create: vi.fn().mockResolvedValue({ id }),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    courseworkAssignment: {
      findFirst: vi.fn().mockResolvedValue({ id, schoolId: id }),
    },
  } as unknown as PrismaClient
  return database
}
beforeEach(() => {
  vi.mocked(visibleCourseworkAssignmentForStudent).mockReset()
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(false)
})
describe('student coursework submissions', () => {
  it('creates only for a currently eligible student before the due date', async () => {
    const database = fixture()
    await expect(
      startCourseworkSubmission(database, id, id),
    ).rejects.toBeInstanceOf(CourseworkSubmissionAccessError)
    expect(database.courseworkSubmission.create).not.toHaveBeenCalled()
    vi.mocked(visibleCourseworkAssignmentForStudent).mockResolvedValue({
      studentId: id,
      enrollment: { id },
      assignment: {
        schoolId: id,
        status: 'published',
        dueAt: new Date('2026-12-01'),
      },
    } as never)
    await startCourseworkSubmission(database, id, id, new Date('2026-09-01'))
    expect(database.courseworkSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ studentId: id, enrollmentId: id }),
    })
  })
  it('does not return another student submission through student access', async () => {
    const database = fixture()
    await expect(
      ownCourseworkSubmission(database, id, id),
    ).rejects.toBeInstanceOf(CourseworkSubmissionAccessError)
    expect(database.courseworkSubmission.findUnique).not.toHaveBeenCalled()
  })
  it('requires assignment management for staff inspection', async () => {
    const database = fixture()
    await expect(
      listCourseworkSubmissionsForStaff(database, id, id, id),
    ).rejects.toBeInstanceOf(CourseworkSubmissionAccessError)
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(true)
    await listCourseworkSubmissionsForStaff(database, id, id, id)
    expect(database.courseworkSubmission.findMany).toHaveBeenCalled()
  })
})
