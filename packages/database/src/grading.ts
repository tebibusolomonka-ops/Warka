import {
  Prisma,
  type Assessment,
  type GradeBand,
  type Mark,
  type PrismaClient,
} from '@prisma/client'
import { z } from 'zod'
import { assessmentConfiguration } from './assessments.js'

const percentage = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/)
  .refine((value) => new Prisma.Decimal(value).lte(100))

export const SaveGradingSchemeSchema = z.object({
  schoolId: z.uuid(),
  bands: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(30),
        minimumPercentage: percentage,
      }),
    )
    .min(1)
    .max(20),
})

export type SaveGradingScheme = z.input<typeof SaveGradingSchemeSchema>

export class InvalidGradingSchemeError extends Error {
  constructor() {
    super('Grade bands must have unique labels and thresholds, including zero')
  }
}

export function orderedGradeBands<
  T extends Pick<GradeBand, 'label' | 'minimumPercentage'>,
>(bands: T[]): T[] {
  if (
    !bands.length ||
    !bands.some((band) => new Prisma.Decimal(band.minimumPercentage).eq(0))
  ) {
    throw new InvalidGradingSchemeError()
  }
  const labels = new Set<string>()
  const thresholds = new Set<string>()
  for (const band of bands) {
    const label = band.label.trim().toLocaleLowerCase()
    const threshold = new Prisma.Decimal(band.minimumPercentage)
    if (
      !label ||
      threshold.lt(0) ||
      threshold.gt(100) ||
      labels.has(label) ||
      thresholds.has(threshold.toFixed(2))
    ) {
      throw new InvalidGradingSchemeError()
    }
    labels.add(label)
    thresholds.add(threshold.toFixed(2))
  }
  return [...bands].sort((left, right) =>
    new Prisma.Decimal(right.minimumPercentage).cmp(left.minimumPercentage),
  )
}

export async function saveGradingScheme(
  database: PrismaClient,
  input: SaveGradingScheme,
) {
  const data = SaveGradingSchemeSchema.parse(input)
  const bands = orderedGradeBands(
    data.bands.map((band) => ({
      label: band.label,
      minimumPercentage: new Prisma.Decimal(band.minimumPercentage),
    })),
  )
  return database.$transaction(async (transaction) => {
    const scheme = await transaction.gradingScheme.upsert({
      where: { schoolId: data.schoolId },
      create: { schoolId: data.schoolId },
      update: {},
    })
    await transaction.gradeBand.deleteMany({
      where: { gradingSchemeId: scheme.id },
    })
    await transaction.gradeBand.createMany({
      data: bands.map((band) => ({
        gradingSchemeId: scheme.id,
        label: band.label,
        minimumPercentage: band.minimumPercentage,
      })),
    })
    return transaction.gradingScheme.findUniqueOrThrow({
      where: { id: scheme.id },
      include: {
        bands: { orderBy: [{ minimumPercentage: 'desc' }, { id: 'asc' }] },
      },
    })
  })
}

export function getGradingScheme(database: PrismaClient, schoolId: string) {
  z.uuid().parse(schoolId)
  return database.gradingScheme.findUnique({
    where: { schoolId },
    include: {
      bands: { orderBy: [{ minimumPercentage: 'desc' }, { id: 'asc' }] },
    },
  })
}

export type CalculatedResult = {
  status: 'ready' | 'incomplete_configuration' | 'missing_marks'
  percentage: string | null
  gradeLabel: string | null
  missingAssessmentIds: string[]
  configurationProblems: string[]
}

export function calculateResult(
  assessments: Pick<Assessment, 'id' | 'maximumScore' | 'weight'>[],
  marks: Pick<Mark, 'assessmentId' | 'score'>[],
  bands: Pick<GradeBand, 'label' | 'minimumPercentage'>[],
): CalculatedResult {
  const configuration = assessmentConfiguration(assessments)
  let orderedBands: typeof bands
  try {
    orderedBands = orderedGradeBands(bands)
  } catch {
    orderedBands = []
  }
  const configurationProblems = [
    ...configuration.problems,
    ...(orderedBands.length ? [] : ['GRADING_SCHEME']),
  ]
  if (configurationProblems.length) {
    return {
      status: 'incomplete_configuration',
      percentage: null,
      gradeLabel: null,
      missingAssessmentIds: [],
      configurationProblems,
    }
  }
  const byAssessment = new Map(
    marks.map((mark) => [mark.assessmentId, mark.score]),
  )
  const missingAssessmentIds = assessments
    .filter((assessment) => !byAssessment.has(assessment.id))
    .map((assessment) => assessment.id)
  if (missingAssessmentIds.length) {
    return {
      status: 'missing_marks',
      percentage: null,
      gradeLabel: null,
      missingAssessmentIds,
      configurationProblems: [],
    }
  }
  const total = assessments.reduce((sum, assessment) => {
    const score = new Prisma.Decimal(byAssessment.get(assessment.id)!)
    const maximum = new Prisma.Decimal(assessment.maximumScore)
    if (maximum.lte(0) || score.lt(0) || score.gt(maximum)) {
      throw new Error('Assessment score is outside the configured range')
    }
    return sum.plus(score.div(maximum).mul(assessment.weight))
  }, new Prisma.Decimal(0))
  const roundedPercentage = total.toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  )
  const band = orderedBands.find((item) =>
    roundedPercentage.gte(item.minimumPercentage),
  )
  if (!band) throw new InvalidGradingSchemeError()
  return {
    status: 'ready',
    percentage: roundedPercentage.toFixed(2),
    gradeLabel: band.label,
    missingAssessmentIds: [],
    configurationProblems: [],
  }
}
