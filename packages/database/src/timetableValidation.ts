import type { Prisma, PrismaClient } from '@prisma/client'
import type { z } from 'zod'
import { ClassTimetableEntryInputSchema } from './classTimetableEntries.js'

export type TimetableProblem = {
  code:
    | 'ASSIGNMENT_SCOPE'
    | 'ASSIGNMENT_INACTIVE'
    | 'PERIOD_SCOPE'
    | 'CLASS_COLLISION'
    | 'TEACHER_COLLISION'
  entryId?: string
}

export async function validateClassTimetableEntry(
  database: PrismaClient | Prisma.TransactionClient,
  input: z.input<typeof ClassTimetableEntryInputSchema>,
  now = new Date(),
  ignoreEntryId?: string,
): Promise<TimetableProblem[]> {
  const value = ClassTimetableEntryInputSchema.parse(input)
  const [assignment, period, classCollision] = await Promise.all([
    database.teachingAssignment.findFirst({
      where: {
        id: value.teachingAssignmentId,
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        schoolClassId: value.schoolClassId,
        subjectId: value.subjectId,
      },
      select: {
        userId: true,
        startsAt: true,
        endsAt: true,
        user: { select: { accountStatus: true } },
      },
    }),
    database.timetablePeriod.findFirst({
      where: { id: value.timetablePeriodId, schoolId: value.schoolId },
      select: { instructional: true },
    }),
    database.classTimetableEntry.findFirst({
      where: {
        schoolId: value.schoolId,
        timetableId: value.timetableId,
        academicYearId: value.academicYearId,
        schoolClassId: value.schoolClassId,
        timetablePeriodId: value.timetablePeriodId,
        weekday: value.weekday,
        ...(ignoreEntryId ? { id: { not: ignoreEntryId } } : {}),
      },
      select: { id: true },
    }),
  ])
  const problems: TimetableProblem[] = []
  if (!assignment) problems.push({ code: 'ASSIGNMENT_SCOPE' })
  else if (
    assignment.startsAt > now ||
    (assignment.endsAt && assignment.endsAt <= now) ||
    assignment.user.accountStatus !== 'active'
  )
    problems.push({ code: 'ASSIGNMENT_INACTIVE' })
  if (!period?.instructional) problems.push({ code: 'PERIOD_SCOPE' })
  if (classCollision)
    problems.push({ code: 'CLASS_COLLISION', entryId: classCollision.id })
  if (assignment) {
    const teacherCollision = await database.classTimetableEntry.findFirst({
      where: {
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        schoolClassId: { not: value.schoolClassId },
        timetablePeriodId: value.timetablePeriodId,
        weekday: value.weekday,
        timetable: { status: { in: ['draft', 'published'] } },
        teachingAssignment: { userId: assignment.userId },
        ...(ignoreEntryId ? { id: { not: ignoreEntryId } } : {}),
      },
      select: { id: true },
    })
    if (teacherCollision)
      problems.push({ code: 'TEACHER_COLLISION', entryId: teacherCollision.id })
  }
  return problems
}

export async function validateSchoolTimetable(
  database: PrismaClient | Prisma.TransactionClient,
  timetableId: string,
  now = new Date(),
) {
  const entries = await database.classTimetableEntry.findMany({
    where: { timetableId },
  })
  const problems: Array<TimetableProblem & { entryId: string }> = []
  for (const entry of entries) {
    const found = await validateClassTimetableEntry(
      database,
      {
        timetableId: entry.timetableId,
        schoolId: entry.schoolId,
        academicYearId: entry.academicYearId,
        schoolClassId: entry.schoolClassId,
        subjectId: entry.subjectId,
        teachingAssignmentId: entry.teachingAssignmentId,
        timetablePeriodId: entry.timetablePeriodId,
        weekday: entry.weekday,
      },
      now,
      entry.id,
    )
    problems.push(
      ...found.map((problem) => ({ ...problem, entryId: entry.id })),
    )
  }
  return problems
}
