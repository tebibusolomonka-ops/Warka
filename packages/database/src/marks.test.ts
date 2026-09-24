import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  getMarksForAssessment,
  getMarksForStudentContext,
  InvalidMarkContextError,
  InvalidMarkScoreError,
  MarkPermissionError,
  recordMark,
  updateDraftMark,
} from './marks.js'

const schoolId = randomUUID()
const actorId = randomUUID()
const studentId = randomUUID()
const enrollmentId = randomUUID()
const assessmentId = randomUUID()
const academicYearId = randomUUID()
const schoolClassId = randomUUID()
const subjectId = randomUUID()
const gradingPeriodId = randomUUID()
const input = { schoolId, enrollmentId, assessmentId, score: '0' }

function fixture(role = 'teacher') {
  const assessment = {
    id: assessmentId,
    schoolId,
    academicYearId,
    schoolClassId,
    subjectId,
    gradingPeriodId,
    maximumScore: new Prisma.Decimal('25.50'),
  }
  const enrollment = {
    id: enrollmentId,
    schoolId,
    studentId,
    academicYearId,
    schoolClassId,
    status: 'approved',
  }
  const mark = {
    id: randomUUID(),
    schoolId,
    studentId,
    enrollmentId,
    assessmentId,
    score: new Prisma.Decimal('0'),
    recordedById: actorId,
  }
  return {
    assessment: { findFirst: vi.fn().mockResolvedValue(assessment) },
    enrollment: { findFirst: vi.fn().mockResolvedValue(enrollment) },
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue({ role }) },
    teachingAssignment: {
      findFirst: vi.fn().mockResolvedValue({ id: randomUUID() }),
    },
    mark: {
      create: vi
        .fn()
        .mockImplementation(async ({ data }) => ({ ...mark, ...data })),
      findFirst: vi.fn().mockResolvedValue(mark),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi
        .fn()
        .mockImplementation(async ({ data }) => ({ ...mark, ...data })),
    },
  } as unknown as PrismaClient
}

describe('student marks', () => {
  it('accepts zero and maximum scores for an assigned teacher and derives attribution', async () => {
    const database = fixture()
    const zero = await recordMark(database, actorId, input)
    expect(zero.studentId).toBe(studentId)
    expect(zero.recordedById).toBe(actorId)
    expect(zero.score.toString()).toBe('0')
    const maximum = await recordMark(database, actorId, {
      ...input,
      score: '25.50',
    })
    expect(maximum.score.toString()).toBe('25.5')
    const updated = await updateDraftMark(
      database,
      actorId,
      schoolId,
      zero.id,
      '12.25',
    )
    expect(updated.score.toString()).toBe('12.25')
    await getMarksForAssessment(database, schoolId, assessmentId)
    await getMarksForStudentContext(
      database,
      schoolId,
      enrollmentId,
      gradingPeriodId,
      subjectId,
    )
    expect(database.mark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId, assessmentId } }),
    )
    expect(database.mark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId,
          enrollmentId,
          assessment: { gradingPeriodId, subjectId },
        },
      }),
    )
  })

  it('rejects out-of-range scores, wrong class, and unapproved enrollment', async () => {
    const database = fixture()
    await expect(
      recordMark(database, actorId, { ...input, score: '25.51' }),
    ).rejects.toBeInstanceOf(InvalidMarkScoreError)
    await expect(
      recordMark(database, actorId, { ...input, score: '-1' }),
    ).rejects.toThrow()
    vi.mocked(database.enrollment.findFirst).mockResolvedValueOnce({
      id: enrollmentId,
      schoolClassId: randomUUID(),
      academicYearId,
      status: 'approved',
    } as never)
    await expect(recordMark(database, actorId, input)).rejects.toBeInstanceOf(
      InvalidMarkContextError,
    )
    vi.mocked(database.enrollment.findFirst).mockResolvedValueOnce({
      id: enrollmentId,
      schoolClassId,
      academicYearId,
      status: 'pending',
    } as never)
    await expect(recordMark(database, actorId, input)).rejects.toBeInstanceOf(
      InvalidMarkContextError,
    )
  })

  it('requires a current assignment for teachers and denies registrars', async () => {
    const teacher = fixture()
    vi.mocked(teacher.teachingAssignment.findFirst).mockResolvedValueOnce(null)
    await expect(recordMark(teacher, actorId, input)).rejects.toBeInstanceOf(
      MarkPermissionError,
    )
    const registrar = fixture('registrar')
    await expect(recordMark(registrar, actorId, input)).rejects.toBeInstanceOf(
      MarkPermissionError,
    )
    const crossSchool = fixture()
    vi.mocked(crossSchool.assessment.findFirst).mockResolvedValueOnce(null)
    await expect(
      recordMark(crossSchool, actorId, input),
    ).rejects.toBeInstanceOf(InvalidMarkContextError)
  })
})
