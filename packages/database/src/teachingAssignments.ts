import {
  Prisma,
  type PrismaClient,
  type TeachingAssignment,
} from '@prisma/client'
import { z } from 'zod'
import { findSchoolMembership } from './schoolMemberships.js'
import { findAcademicYearById } from './academicYears.js'
import { findSchoolClassById } from './schoolClasses.js'
import { findSubjectById } from './subjects.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'

export const AssignTeacherSchema = z.object({
  schoolId: z.uuid(),
  userId: z.uuid(),
  academicYearId: z.uuid(),
  schoolClassId: z.uuid(),
  subjectId: z.uuid(),
  startsAt: z.date().optional(),
  endsAt: z.date().nullable().optional(),
})

export type AssignTeacher = z.input<typeof AssignTeacherSchema>

export class InvalidTeachingAssignmentError extends Error {
  constructor() {
    super('Teacher and academic context must belong to the same school')
  }
}

export class DuplicateTeachingAssignmentError extends Error {
  constructor() {
    super('Teacher is already assigned to this class subject')
  }
}

export async function assignTeacher(
  database: PrismaClient,
  input: AssignTeacher,
): Promise<TeachingAssignment> {
  const data = AssignTeacherSchema.parse(input)
  if (data.endsAt && data.endsAt <= (data.startsAt ?? new Date()))
    throw new InvalidTeachingAssignmentError()
  const [membership, year, schoolClass, subject] = await Promise.all([
    findSchoolMembership(database, data.userId, data.schoolId),
    findAcademicYearById(database, data.schoolId, data.academicYearId),
    findSchoolClassById(database, data.schoolId, data.schoolClassId),
    findSubjectById(database, data.schoolId, data.subjectId),
  ])
  if (
    !membership ||
    !['teacher', 'administrator'].includes(membership.role) ||
    !year ||
    !schoolClass ||
    schoolClass.academicYearId !== data.academicYearId ||
    !subject
  ) {
    throw new InvalidTeachingAssignmentError()
  }
  const startsAt = data.startsAt ?? new Date()
  const overlap = await database.teachingAssignment.findFirst({
    where: {
      userId: data.userId,
      schoolClassId: data.schoolClassId,
      subjectId: data.subjectId,
      academicYearId: data.academicYearId,
      ...(data.endsAt ? { startsAt: { lt: data.endsAt } } : {}),
      OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
    },
  })
  if (overlap) throw new DuplicateTeachingAssignmentError()
  try {
    const { startsAt: requestedStart, endsAt, ...base } = data
    return await database.teachingAssignment.create({
      data: {
        ...base,
        ...(requestedStart ? { startsAt: requestedStart } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateTeachingAssignmentError()
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new InvalidTeachingAssignmentError()
    }
    throw error
  }
}

export async function removeTeachingAssignment(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<boolean> {
  const result = await database.teachingAssignment.updateMany({
    where: {
      id,
      schoolId,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    data: { endsAt: new Date() },
  })
  return result.count === 1
}

export function listTeacherAssignments(
  database: PrismaClient,
  schoolId: string,
  userId: string,
): Promise<TeachingAssignment[]> {
  return database.teachingAssignment.findMany({
    where: { schoolId, userId, ...effectiveMembershipWhere() },
    orderBy: [
      { academicYearId: 'asc' },
      { schoolClassId: 'asc' },
      { subjectId: 'asc' },
    ],
  })
}

export function listClassSubjectAssignments(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
  subjectId: string,
): Promise<TeachingAssignment[]> {
  return database.teachingAssignment.findMany({
    where: {
      schoolId,
      academicYearId,
      schoolClassId,
      subjectId,
      ...effectiveMembershipWhere(),
    },
    orderBy: [{ userId: 'asc' }, { id: 'asc' }],
  })
}

export async function mayManageClassSubject(
  database: PrismaClient,
  userId: string,
  schoolId: string,
  academicYearId: string,
  schoolClassId: string,
  subjectId: string,
): Promise<boolean> {
  const membership = await findSchoolMembership(database, userId, schoolId)
  if (!membership || !['teacher', 'administrator'].includes(membership.role)) {
    return false
  }
  const assignment = await database.teachingAssignment.findFirst({
    where: {
      userId,
      schoolId,
      academicYearId,
      schoolClassId,
      subjectId,
      ...effectiveMembershipWhere(),
    },
    select: { id: true },
  })
  return assignment !== null
}
