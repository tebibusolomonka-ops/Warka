import { Prisma, type Assessment, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findGradingPeriodById } from './gradingPeriods.js'
import { findSchoolClassById } from './schoolClasses.js'
import { findSubjectById } from './subjects.js'

const positiveScore = z
  .string()
  .regex(/^\d{1,6}(\.\d{1,2})?$/)
  .refine((value) => new Prisma.Decimal(value).gt(0))
const percentage = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/)
  .refine((value) => {
    const decimal = new Prisma.Decimal(value)
    return decimal.gt(0) && decimal.lte(100)
  })

export const CreateAssessmentSchema = z.object({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  gradingPeriodId: z.uuid(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  maximumScore: positiveScore,
  weight: percentage,
  position: z.number().int().min(0).max(1000),
})

export type CreateAssessment = z.input<typeof CreateAssessmentSchema>

export class InvalidAssessmentContextError extends Error {
  constructor() {
    super('Assessment context must belong to the same school and academic year')
  }
}

export class DuplicateAssessmentError extends Error {
  constructor() {
    super('Assessment name or position already exists in this context')
  }
}

export function assessmentConfiguration(
  assessments: Pick<Assessment, 'weight'>[],
): {
  ready: boolean
  totalWeight: string
  problems: ('NO_ASSESSMENTS' | 'WEIGHT_TOTAL')[]
} {
  const total = assessments.reduce(
    (sum, assessment) => sum.plus(assessment.weight),
    new Prisma.Decimal(0),
  )
  const problems: ('NO_ASSESSMENTS' | 'WEIGHT_TOTAL')[] = []
  if (assessments.length === 0) problems.push('NO_ASSESSMENTS')
  if (!total.eq(100)) problems.push('WEIGHT_TOTAL')
  return {
    ready: problems.length === 0,
    totalWeight: total.toFixed(2),
    problems,
  }
}

export async function createAssessment(
  database: PrismaClient,
  input: CreateAssessment,
): Promise<Assessment> {
  const data = CreateAssessmentSchema.parse(input)
  const [period, schoolClass, subject] = await Promise.all([
    findGradingPeriodById(
      database,
      data.schoolId,
      data.academicYearId,
      data.gradingPeriodId,
    ),
    findSchoolClassById(database, data.schoolId, data.schoolClassId),
    findSubjectById(database, data.schoolId, data.subjectId),
  ])
  if (
    !period ||
    !schoolClass ||
    schoolClass.academicYearId !== data.academicYearId ||
    !subject
  ) {
    throw new InvalidAssessmentContextError()
  }
  try {
    return await database.assessment.create({
      data: {
        ...data,
        maximumScore: new Prisma.Decimal(data.maximumScore),
        weight: new Prisma.Decimal(data.weight),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateAssessmentError()
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new InvalidAssessmentContextError()
    }
    throw error
  }
}

export function findAssessmentById(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<Assessment | null> {
  return database.assessment.findFirst({ where: { schoolId, id } })
}

export function listAssessments(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
  gradingPeriodId: string,
  schoolClassId: string,
  subjectId: string,
): Promise<Assessment[]> {
  return database.assessment.findMany({
    where: {
      schoolId,
      academicYearId,
      gradingPeriodId,
      schoolClassId,
      subjectId,
    },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  })
}
