import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  applyMarkImport,
  InvalidMarkImportError,
  validateMarkImport,
} from './markImport.js'
import { MarkPermissionError } from './marks.js'

const schoolId = randomUUID()
const actorId = randomUUID()
const assessmentId = randomUUID()
const academicYearId = randomUUID()
const schoolClassId = randomUUID()
const subjectId = randomUUID()
const firstStudentId = randomUUID()
const secondStudentId = randomUUID()
const firstEnrollmentId = randomUUID()
const secondEnrollmentId = randomUUID()
const references = new Map([
  ['WKA-FIRST', { id: firstStudentId, enrollmentId: firstEnrollmentId }],
  ['WKA-SECOND', { id: secondStudentId, enrollmentId: secondEnrollmentId }],
  ['WKA-OUTSIDE', { id: randomUUID(), enrollmentId: randomUUID() }],
])

function fixture(role = 'teacher') {
  const database = {
    assessment: {
      findFirst: vi.fn().mockResolvedValue({
        id: assessmentId,
        schoolId,
        academicYearId,
        schoolClassId,
        subjectId,
        maximumScore: new Prisma.Decimal('25.50'),
      }),
    },
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue({ role }) },
    teachingAssignment: {
      findFirst: vi.fn().mockResolvedValue({ id: randomUUID() }),
    },
    student: {
      findUnique: vi
        .fn()
        .mockImplementation(
          async ({ where }) => references.get(where.studentReference) ?? null,
        ),
    },
    enrollment: {
      findFirst: vi.fn().mockImplementation(async ({ where }) => {
        const reference = [...references.values()].find(
          (item) => item.id === where.studentId,
        )
        if (!reference) return null
        return {
          id: reference.enrollmentId,
          schoolClassId:
            where.studentId === references.get('WKA-OUTSIDE')?.id
              ? randomUUID()
              : schoolClassId,
          status: 'approved',
        }
      }),
    },
    mark: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi
      .fn()
      .mockImplementation(async (callback) => callback(database)),
  } as unknown as PrismaClient
  return database
}

describe('CSV mark import', () => {
  it('validates a reviewed CSV and applies only after explicit request', async () => {
    const database = fixture()
    const csv =
      '\uFEFFstudentReference,score\r\n"WKA-FIRST","0"\r\nWKA-SECOND,25.50\r\n'
    const review = await validateMarkImport(
      database,
      actorId,
      schoolId,
      assessmentId,
      csv,
    )
    expect(review.valid).toBe(true)
    expect(
      review.rows.map(({ studentReference, score, action }) => ({
        studentReference,
        score,
        action,
      })),
    ).toEqual([
      { studentReference: 'WKA-FIRST', score: '0.00', action: 'create' },
      { studentReference: 'WKA-SECOND', score: '25.50', action: 'create' },
    ])
    expect(database.mark.create).not.toHaveBeenCalled()
    expect(
      await applyMarkImport(database, actorId, schoolId, assessmentId, csv),
    ).toEqual({
      created: 2,
      updated: 0,
    })
    expect(database.$transaction).toHaveBeenCalledOnce()
    expect(database.mark.create).toHaveBeenCalledTimes(2)
  })

  it('returns row-level problems and never writes a partial import', async () => {
    const database = fixture()
    const csv =
      'studentReference,score\nWKA-FIRST,10\nWKA-FIRST,11\nWKA-UNKNOWN,12\nWKA-OUTSIDE,5\nWKA-SECOND,bad\n'
    const review = await validateMarkImport(
      database,
      actorId,
      schoolId,
      assessmentId,
      csv,
    )
    expect(review.valid).toBe(false)
    expect(review.problems.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_STUDENT',
        'UNKNOWN_STUDENT',
        'OUTSIDE_CLASS',
        'INVALID_SCORE',
      ]),
    )
    await expect(
      applyMarkImport(database, actorId, schoolId, assessmentId, csv),
    ).rejects.toBeInstanceOf(InvalidMarkImportError)
    expect(database.mark.create).not.toHaveBeenCalled()
  })

  it('rejects missing headers, malformed scores, and scores above the maximum', async () => {
    const database = fixture()
    const cases = [
      ['student,score\nWKA-FIRST,10', 'MISSING_HEADER'],
      ['studentReference,score\nWKA-FIRST,not-a-number', 'INVALID_SCORE'],
      ['studentReference,score\nWKA-FIRST,25.51', 'SCORE_EXCEEDS_MAXIMUM'],
      ['studentReference,score\n"WKA-FIRST,10', 'MALFORMED_CSV'],
    ] as const
    for (const [csv, code] of cases) {
      const review = await validateMarkImport(
        database,
        actorId,
        schoolId,
        assessmentId,
        csv,
      )
      expect(review.problems.some((problem) => problem.code === code)).toBe(
        true,
      )
    }
  })

  it('enforces teacher assignment before returning student matching results', async () => {
    const database = fixture('registrar')
    await expect(
      validateMarkImport(
        database,
        actorId,
        schoolId,
        assessmentId,
        'studentReference,score\nWKA-FIRST,10',
      ),
    ).rejects.toBeInstanceOf(MarkPermissionError)
    expect(database.student.findUnique).not.toHaveBeenCalled()
  })
})
