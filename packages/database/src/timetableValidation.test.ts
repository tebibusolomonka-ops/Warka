import { describe, expect, it, vi } from 'vitest'
import { validateClassTimetableEntry } from './timetableValidation.js'

const now = new Date('2026-09-28T12:00:00.000Z')
const input = {
  schoolId: 'a5d6c96b-5da1-4c6e-b918-12f47fc29f0d',
  academicYearId: 'a3b17d3e-26d7-4f2d-9b40-08d2b5ca2dc6',
  schoolClassId: '34b16bc1-1f37-4743-9089-5e872ce6cb82',
  subjectId: 'e2f4a8c2-4e11-4bc7-8998-8ad55710f219',
  teachingAssignmentId: '1e80be56-03c0-4df9-86ef-42f07d90b501',
  timetablePeriodId: 'ba287154-f61f-456f-bc48-6de369d4e04e',
  weekday: 1,
}

function fixture(
  options: {
    assignment?: object | null
    period?: object | null
    classCollision?: object | null
    teacherCollision?: object | null
  } = {},
) {
  const assignment =
    options.assignment === undefined
      ? {
          userId: 'teacher',
          startsAt: new Date('2026-01-01'),
          endsAt: null,
          user: { accountStatus: 'active' },
        }
      : options.assignment
  const classFind = vi
    .fn()
    .mockResolvedValueOnce(options.classCollision ?? null)
    .mockResolvedValueOnce(options.teacherCollision ?? null)
  return {
    teachingAssignment: { findFirst: vi.fn().mockResolvedValue(assignment) },
    timetablePeriod: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.period ?? { instructional: true }),
    },
    classTimetableEntry: { findFirst: classFind },
  }
}

describe('timetable conflict validation', () => {
  it('accepts a scoped non-conflicting assignment', async () => {
    const database = fixture()
    expect(
      await validateClassTimetableEntry(database as never, input, now),
    ).toEqual([])
    expect(database.teachingAssignment.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        schoolId: input.schoolId,
        academicYearId: input.academicYearId,
        schoolClassId: input.schoolClassId,
        subjectId: input.subjectId,
      }),
      select: expect.any(Object),
    })
  })

  it('reports class and teacher collisions explicitly', async () => {
    const database = fixture({
      classCollision: { id: 'class-entry' },
      teacherCollision: { id: 'teacher-entry' },
    })
    expect(
      await validateClassTimetableEntry(database as never, input, now),
    ).toEqual([
      { code: 'CLASS_COLLISION', entryId: 'class-entry' },
      { code: 'TEACHER_COLLISION', entryId: 'teacher-entry' },
    ])
  })

  it('rejects expired or cross-school assignments', async () => {
    const expired = fixture({
      assignment: {
        userId: 'teacher',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-09-01'),
        user: { accountStatus: 'active' },
      },
    })
    expect(
      await validateClassTimetableEntry(expired as never, input, now),
    ).toContainEqual({
      code: 'ASSIGNMENT_INACTIVE',
    })
    const wrongSchool = fixture({ assignment: null })
    expect(
      await validateClassTimetableEntry(wrongSchool as never, input, now),
    ).toContainEqual({
      code: 'ASSIGNMENT_SCOPE',
    })
  })
})
