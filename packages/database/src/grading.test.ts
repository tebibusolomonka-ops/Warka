import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  Prisma,
  type Assessment,
  type GradeBand,
  type Mark,
  type PrismaClient,
} from '@prisma/client'
import {
  calculateResult,
  InvalidGradingSchemeError,
  orderedGradeBands,
  saveGradingScheme,
} from './grading.js'

const firstId = randomUUID()
const secondId = randomUUID()
const assessments = [
  {
    id: firstId,
    maximumScore: new Prisma.Decimal('20'),
    weight: new Prisma.Decimal('40'),
  },
  {
    id: secondId,
    maximumScore: new Prisma.Decimal('50'),
    weight: new Prisma.Decimal('60'),
  },
] as Assessment[]
const bands = [
  { label: 'Below', minimumPercentage: new Prisma.Decimal('0') },
  { label: 'High', minimumPercentage: new Prisma.Decimal('80') },
  { label: 'Middle', minimumPercentage: new Prisma.Decimal('50') },
] as GradeBand[]
const marks = (first: string, second: string) =>
  [
    { assessmentId: firstId, score: new Prisma.Decimal(first) },
    { assessmentId: secondId, score: new Prisma.Decimal(second) },
  ] as Mark[]

describe('result calculation', () => {
  it('weights scores by each assessment maximum and applies a school band', () => {
    expect(
      calculateResult(assessments, marks('15', '40'), bands),
    ).toMatchObject({
      status: 'ready',
      percentage: '78.00',
      gradeLabel: 'Middle',
    })
  })

  it('selects threshold boundaries deterministically', () => {
    expect(
      calculateResult(assessments, marks('10', '50'), bands).gradeLabel,
    ).toBe('High')
    expect(calculateResult(assessments, marks('0', '0'), bands)).toMatchObject({
      percentage: '0.00',
      gradeLabel: 'Below',
    })
    expect(
      calculateResult(assessments, marks('20', '50'), bands),
    ).toMatchObject({
      percentage: '100.00',
      gradeLabel: 'High',
    })
  })

  it('rounds half up to two decimal places before selecting a band', () => {
    const thirds = [
      {
        id: firstId,
        maximumScore: new Prisma.Decimal('3'),
        weight: new Prisma.Decimal('100'),
      },
    ] as Assessment[]
    expect(calculateResult(thirds, [marks('1', '0')[0]!], bands)).toMatchObject(
      {
        percentage: '33.33',
        gradeLabel: 'Below',
      },
    )
  })

  it('reports missing marks without treating them as zero', () => {
    expect(
      calculateResult(assessments, [marks('0', '0')[0]!], bands),
    ).toMatchObject({
      status: 'missing_marks',
      percentage: null,
      missingAssessmentIds: [secondId],
    })
  })

  it('rejects incomplete assessment configuration and missing grading bands', () => {
    expect(
      calculateResult(assessments.slice(0, 1), marks('20', '50'), bands),
    ).toMatchObject({
      status: 'incomplete_configuration',
      configurationProblems: ['WEIGHT_TOTAL'],
    })
    expect(calculateResult(assessments, marks('20', '50'), [])).toMatchObject({
      status: 'incomplete_configuration',
      configurationProblems: ['GRADING_SCHEME'],
    })
  })

  it('requires a zero band and unique labels and thresholds', () => {
    expect(() => orderedGradeBands(bands.slice(1))).toThrow(
      InvalidGradingSchemeError,
    )
    expect(() => orderedGradeBands([...bands, bands[0]!])).toThrow(
      InvalidGradingSchemeError,
    )
    expect(() =>
      orderedGradeBands([
        ...bands,
        {
          label: 'LOW',
          minimumPercentage: new Prisma.Decimal('20'),
        } as GradeBand,
      ]),
    ).not.toThrow()
    expect(orderedGradeBands(bands).map((band) => band.label)).toEqual([
      'High',
      'Middle',
      'Below',
    ])
  })

  it('replaces the scheme bands within one transaction', async () => {
    const schoolId = randomUUID()
    const schemeId = randomUUID()
    const database = {
      gradingScheme: {
        upsert: vi.fn().mockResolvedValue({ id: schemeId }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: schemeId }),
      },
      gradeBand: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: vi
        .fn()
        .mockImplementation(async (callback) => callback(database)),
    } as unknown as PrismaClient
    await saveGradingScheme(database, {
      schoolId,
      bands: [
        { label: 'High', minimumPercentage: '75' },
        { label: 'Other', minimumPercentage: '0' },
      ],
    })
    expect(database.$transaction).toHaveBeenCalledOnce()
    expect(database.gradeBand.createMany).toHaveBeenCalledOnce()
  })
})
