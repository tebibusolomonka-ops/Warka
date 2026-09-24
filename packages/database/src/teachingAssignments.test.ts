import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  assignTeacher,
  InvalidTeachingAssignmentError,
  listClassSubjectAssignments,
  listTeacherAssignments,
  mayManageClassSubject,
  removeTeachingAssignment,
} from './teachingAssignments.js'

const schoolId = randomUUID()
const userId = randomUUID()
const academicYearId = randomUUID()
const schoolClassId = randomUUID()
const subjectId = randomUUID()
const input = { schoolId, userId, academicYearId, schoolClassId, subjectId }

function fixture(role = 'teacher') {
  const database = {
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue({ role }),
    },
    academicYear: {
      findFirst: vi.fn().mockResolvedValue({ id: academicYearId }),
    },
    schoolClass: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: schoolClassId, academicYearId }),
    },
    subject: {
      findFirst: vi.fn().mockResolvedValue({ id: subjectId }),
    },
    teachingAssignment: {
      create: vi.fn().mockImplementation(async ({ data }) => data),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: randomUUID() }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient
  return database
}

describe('teaching assignments', () => {
  it('validates a current teacher role and the same academic context', async () => {
    const database = fixture()
    await expect(assignTeacher(database, input)).resolves.toMatchObject(input)
    expect(database.teachingAssignment.create).toHaveBeenCalledWith({
      data: input,
    })
    expect(
      await mayManageClassSubject(
        database,
        userId,
        schoolId,
        academicYearId,
        schoolClassId,
        subjectId,
      ),
    ).toBe(true)
    expect(database.teachingAssignment.findFirst).toHaveBeenCalledWith({
      where: input,
      select: { id: true },
    })
    await listTeacherAssignments(database, schoolId, userId)
    await listClassSubjectAssignments(
      database,
      schoolId,
      academicYearId,
      schoolClassId,
      subjectId,
    )
    expect(database.teachingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId, userId } }),
    )
    expect(database.teachingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId, academicYearId, schoolClassId, subjectId },
      }),
    )
    expect(
      await removeTeachingAssignment(database, schoolId, randomUUID()),
    ).toBe(true)
  })

  it('rejects a non-teacher or mismatched class year', async () => {
    const registrar = fixture('registrar')
    await expect(assignTeacher(registrar, input)).rejects.toBeInstanceOf(
      InvalidTeachingAssignmentError,
    )
    expect(
      await mayManageClassSubject(
        registrar,
        userId,
        schoolId,
        academicYearId,
        schoolClassId,
        subjectId,
      ),
    ).toBe(false)
    const wrongYear = fixture()
    vi.mocked(wrongYear.schoolClass.findFirst).mockResolvedValueOnce({
      id: schoolClassId,
      academicYearId: randomUUID(),
    } as never)
    await expect(assignTeacher(wrongYear, input)).rejects.toBeInstanceOf(
      InvalidTeachingAssignmentError,
    )
    const wrongSubject = fixture()
    vi.mocked(wrongSubject.subject.findFirst).mockResolvedValueOnce(null)
    await expect(assignTeacher(wrongSubject, input)).rejects.toBeInstanceOf(
      InvalidTeachingAssignmentError,
    )
  })
})
