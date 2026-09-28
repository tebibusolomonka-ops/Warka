import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const ClassTimetableEntryInputSchema = z.strictObject({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
  teachingAssignmentId: z.uuid(),
  timetablePeriodId: z.uuid(),
  weekday: z.number().int().min(1).max(7),
})

export class ClassTimetableEntryError extends Error {}

export async function createClassTimetableEntry(
  database: PrismaClient,
  input: z.input<typeof ClassTimetableEntryInputSchema>,
) {
  const value = ClassTimetableEntryInputSchema.parse(input)
  const period = await database.timetablePeriod.findFirst({
    where: { id: value.timetablePeriodId, schoolId: value.schoolId },
    select: { instructional: true },
  })
  if (!period?.instructional)
    throw new ClassTimetableEntryError('Instructional period required')
  try {
    return await database.classTimetableEntry.create({ data: value })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003'].includes(error.code)
    )
      throw new ClassTimetableEntryError('Timetable entry conflicts with scope')
    throw error
  }
}

export async function listClassTimetableEntries(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
) {
  return database.classTimetableEntry.findMany({
    where: { schoolId, academicYearId, schoolClassId },
    include: { subject: true, timetablePeriod: true, teachingAssignment: true },
    orderBy: [{ weekday: 'asc' }, { timetablePeriod: { sortOrder: 'asc' } }],
  })
}
