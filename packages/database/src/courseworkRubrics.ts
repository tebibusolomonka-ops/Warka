import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'

export class CourseworkRubricError extends Error {}
const plain = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !/<[^>]+>/.test(value), 'HTML is not accepted')
const points = z
  .string()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0 && Number(value) <= 100)
export const CourseworkRubricInputSchema = z.strictObject({
  title: plain(200),
  criteria: z
    .array(
      z.strictObject({
        title: plain(200),
        description: plain(1000),
        maxPoints: points,
      }),
    )
    .min(1)
    .max(20),
})

async function editableAssignment(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
) {
  const assignment = await database.courseworkAssignment.findFirst({
    where: {
      id: assignmentId,
      schoolId,
      status: { in: ['draft', 'published'] },
    },
  })
  if (
    !assignment ||
    !(await mayManageCourseworkAssignment(database, actorId, assignment))
  )
    throw new CourseworkRubricError('Editable assignment required')
  return assignment
}

function parseRubric(input: unknown) {
  const value = CourseworkRubricInputSchema.parse(input)
  const total = value.criteria.reduce(
    (sum, criterion) => sum.plus(new Prisma.Decimal(criterion.maxPoints)),
    new Prisma.Decimal(0),
  )
  if (total.greaterThan(1000))
    throw new CourseworkRubricError('Rubric total exceeds 1000 points')
  return { value, total }
}

export async function createCourseworkRubric(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  input: unknown,
) {
  await editableAssignment(database, actorId, schoolId, assignmentId)
  const { value } = parseRubric(input)
  return database.courseworkRubric.create({
    data: {
      schoolId,
      assignmentId,
      createdById: actorId,
      title: value.title,
      criteria: {
        create: value.criteria.map((criterion, index) => ({
          title: criterion.title,
          description: criterion.description,
          maxPoints: new Prisma.Decimal(criterion.maxPoints),
          sortOrder: index + 1,
        })),
      },
    },
    include: { criteria: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function replaceCourseworkRubric(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  input: unknown,
) {
  await editableAssignment(database, actorId, schoolId, assignmentId)
  const { value } = parseRubric(input)
  return database.$transaction(
    async (transaction) => {
      const rubric = await transaction.courseworkRubric.findFirst({
        where: { assignmentId, schoolId, frozenAt: null },
      })
      if (!rubric) throw new CourseworkRubricError('Editable rubric required')
      await transaction.rubricCriterion.deleteMany({
        where: { rubricId: rubric.id },
      })
      await transaction.rubricCriterion.createMany({
        data: value.criteria.map((criterion, index) => ({
          rubricId: rubric.id,
          title: criterion.title,
          description: criterion.description,
          maxPoints: new Prisma.Decimal(criterion.maxPoints),
          sortOrder: index + 1,
        })),
      })
      return transaction.courseworkRubric.update({
        where: { id: rubric.id, frozenAt: null },
        data: { title: value.title },
        include: { criteria: { orderBy: { sortOrder: 'asc' } } },
      })
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function cloneCourseworkRubric(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  sourceAssignmentId: string,
  targetAssignmentId: string,
) {
  const source = await database.courseworkAssignment.findFirst({
    where: { id: sourceAssignmentId, schoolId },
  })
  if (
    !source ||
    !(await mayManageCourseworkAssignment(database, actorId, source))
  )
    throw new CourseworkRubricError('Source rubric access required')
  const rubric = await database.courseworkRubric.findFirst({
    where: { assignmentId: sourceAssignmentId, schoolId },
    include: { criteria: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!rubric) throw new CourseworkRubricError('Source rubric required')
  return createCourseworkRubric(
    database,
    actorId,
    schoolId,
    targetAssignmentId,
    {
      title: rubric.title,
      criteria: rubric.criteria.map((criterion) => ({
        title: criterion.title,
        description: criterion.description,
        maxPoints: criterion.maxPoints.toString(),
      })),
    },
  )
}

export async function getCourseworkRubric(
  database: PrismaClient,
  assignmentId: string,
) {
  const rubric = await database.courseworkRubric.findFirst({
    where: { assignmentId },
    include: { criteria: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!rubric) return null
  return {
    ...rubric,
    totalPoints: rubric.criteria
      .reduce(
        (sum, criterion) => sum.plus(criterion.maxPoints),
        new Prisma.Decimal(0),
      )
      .toString(),
  }
}
