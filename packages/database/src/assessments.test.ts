import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  assessmentConfiguration,
  createAssessment,
  InvalidAssessmentContextError,
  listAssessments,
} from './assessments.js'

const schoolId = randomUUID()
const academicYearId = randomUUID()
const gradingPeriodId = randomUUID()
const schoolClassId = randomUUID()
const subjectId = randomUUID()
const input = {
  schoolId,
  academicYearId,
  gradingPeriodId,
  schoolClassId,
  subjectId,
  name: 'Quiz',
  maximumScore: '25.50',
  weight: '33.33',
  position: 0,
}

function fixture() {
  return {
    gradingPeriod: {
      findFirst: vi.fn().mockResolvedValue({ id: gradingPeriodId }),
    },
    schoolClass: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: schoolClassId, academicYearId }),
    },
    subject: {
      findFirst: vi.fn().mockResolvedValue({ id: subjectId }),
    },
    assessment: {
      create: vi.fn().mockImplementation(async ({ data }) => data),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient
}

describe('assessment definitions', () => {
  it('uses exact decimal values and checks context', async () => {
    const database = fixture()
    const assessment = await createAssessment(database, input)
    expect(assessment.maximumScore.toString()).toBe('25.5')
    expect(assessment.weight.toString()).toBe('33.33')
    await listAssessments(
      database,
      schoolId,
      academicYearId,
      gradingPeriodId,
      schoolClassId,
      subjectId,
    )
    expect(database.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId,
          academicYearId,
          gradingPeriodId,
          schoolClassId,
          subjectId,
        },
      }),
    )
    vi.mocked(database.subject.findFirst).mockResolvedValueOnce(null)
    await expect(createAssessment(database, input)).rejects.toBeInstanceOf(
      InvalidAssessmentContextError,
    )
  })

  it('validates maximum score and weight without demanding a complete set on first creation', async () => {
    const database = fixture()
    for (const invalid of [
      { maximumScore: '0' },
      { maximumScore: '-1' },
      { weight: '0' },
      { weight: '100.01' },
      { weight: '0.001' },
    ]) {
      await expect(
        createAssessment(database, { ...input, ...invalid }),
      ).rejects.toThrow()
    }
    expect(assessmentConfiguration([])).toEqual({
      ready: false,
      totalWeight: '0.00',
      problems: ['NO_ASSESSMENTS', 'WEIGHT_TOTAL'],
    })
    expect(
      assessmentConfiguration([{ weight: new Prisma.Decimal('33.33') }]).ready,
    ).toBe(false)
    expect(
      assessmentConfiguration([
        { weight: new Prisma.Decimal('33.33') },
        { weight: new Prisma.Decimal('33.33') },
        { weight: new Prisma.Decimal('33.34') },
      ]),
    ).toEqual({ ready: true, totalWeight: '100.00', problems: [] })
  })
})
