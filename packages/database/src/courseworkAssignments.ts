import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findSchoolMembership } from './schoolMemberships.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'

const plainText = z
  .string()
  .trim()
  .min(1)
  .max(10000)
  .refine((value) => !/<[^>]+>/.test(value), 'HTML is not accepted')
export const CreateCourseworkAssignmentSchema = z.strictObject({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  gradingPeriodId: z.uuid().nullable().optional(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
  assessmentId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  instructions: plainText,
  dueAt: z.iso.datetime({ offset: true }),
})

export class CourseworkAssignmentAccessError extends Error {}
export class CourseworkAssignmentContextError extends Error {}

export async function createCourseworkAssignment(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof CreateCourseworkAssignmentSchema>,
) {
  z.uuid().parse(actorId)
  const value = CreateCourseworkAssignmentSchema.parse(input)
  const membership = await findSchoolMembership(
    database,
    actorId,
    value.schoolId,
  )
  if (membership?.role !== 'teacher')
    throw new CourseworkAssignmentAccessError(
      'Active teacher membership required',
    )
  const assignment = await database.teachingAssignment.findFirst({
    where: {
      userId: actorId,
      schoolId: value.schoolId,
      academicYearId: value.academicYearId,
      schoolClassId: value.schoolClassId,
      subjectId: value.subjectId,
      ...effectiveMembershipWhere(),
    },
    select: { id: true },
  })
  if (!assignment)
    throw new CourseworkAssignmentAccessError(
      'Active class and subject assignment required',
    )
  if (value.gradingPeriodId) {
    const period = await database.gradingPeriod.findFirst({
      where: {
        id: value.gradingPeriodId,
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
      },
      select: { id: true },
    })
    if (!period)
      throw new CourseworkAssignmentContextError(
        'Grading period is outside the assignment context',
      )
  }
  if (value.assessmentId) {
    if (!value.gradingPeriodId)
      throw new CourseworkAssignmentContextError(
        'Linked assessment requires a grading period',
      )
    const assessment = await database.assessment.findFirst({
      where: {
        id: value.assessmentId,
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        schoolClassId: value.schoolClassId,
        subjectId: value.subjectId,
        gradingPeriodId: value.gradingPeriodId,
      },
      select: { id: true },
    })
    if (!assessment)
      throw new CourseworkAssignmentContextError(
        'Linked assessment must match the coursework context',
      )
  }
  try {
    return await database.courseworkAssignment.create({
      data: {
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        gradingPeriodId: value.gradingPeriodId ?? null,
        schoolClassId: value.schoolClassId,
        subjectId: value.subjectId,
        teachingAssignmentId: assignment.id,
        assessmentId: value.assessmentId ?? null,
        createdById: actorId,
        title: value.title,
        instructions: value.instructions,
        dueAt: new Date(value.dueAt),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    )
      throw new CourseworkAssignmentContextError('Coursework context changed')
    throw error
  }
}
