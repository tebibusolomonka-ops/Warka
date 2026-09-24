import {
  Prisma,
  type Enrollment,
  type EnrollmentStatus,
  type PrismaClient,
} from '@prisma/client'
import { z } from 'zod'

export const CreateEnrollmentSchema = z.strictObject({
  studentId: z.uuid(),
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  gradeLevelId: z.uuid(),
  schoolClassId: z.uuid().optional(),
})

export type CreateEnrollment = z.input<typeof CreateEnrollmentSchema>
export type EnrollmentAction = 'submit' | 'approve' | 'withdraw'

const allowedStatuses: Record<EnrollmentAction, readonly EnrollmentStatus[]> = {
  submit: ['draft'],
  approve: ['pending'],
  withdraw: ['draft', 'pending', 'approved'],
}

const nextStatus: Record<EnrollmentAction, EnrollmentStatus> = {
  submit: 'pending',
  approve: 'approved',
  withdraw: 'withdrawn',
}

export class InvalidEnrollmentStructureError extends Error {
  constructor() {
    super('Academic year, grade level, and class must match the school')
  }
}

export class DuplicateEnrollmentError extends Error {
  constructor() {
    super('Student already has an enrollment in this school and academic year')
  }
}

export class EnrollmentNotFoundError extends Error {
  constructor() {
    super('Enrollment not found')
  }
}

export class InvalidEnrollmentTransitionError extends Error {
  constructor() {
    super('Enrollment cannot make this transition')
  }
}

export function canTransition(
  status: EnrollmentStatus,
  action: EnrollmentAction,
): boolean {
  return allowedStatuses[action].includes(status)
}

export async function createEnrollment(
  database: PrismaClient,
  input: CreateEnrollment,
): Promise<Enrollment> {
  const data = CreateEnrollmentSchema.parse(input)
  const [year, grade, schoolClass] = await Promise.all([
    database.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId: data.schoolId },
      select: { id: true },
    }),
    database.gradeLevel.findFirst({
      where: { id: data.gradeLevelId, schoolId: data.schoolId },
      select: { id: true },
    }),
    data.schoolClassId
      ? database.schoolClass.findFirst({
          where: {
            id: data.schoolClassId,
            schoolId: data.schoolId,
            academicYearId: data.academicYearId,
            gradeLevelId: data.gradeLevelId,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  if (!year || !grade || (data.schoolClassId && !schoolClass)) {
    throw new InvalidEnrollmentStructureError()
  }

  try {
    return await database.enrollment.create({
      data: {
        studentId: data.studentId,
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
        gradeLevelId: data.gradeLevelId,
        ...(data.schoolClassId ? { schoolClassId: data.schoolClassId } : {}),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateEnrollmentError()
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new InvalidEnrollmentStructureError()
    }
    throw error
  }
}

export function findEnrollmentById(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<Enrollment | null> {
  return database.enrollment.findFirst({ where: { id, schoolId } })
}

async function applyTransition(
  database: PrismaClient,
  schoolId: string,
  id: string,
  action: EnrollmentAction,
  now: Date,
): Promise<Enrollment> {
  const result = await database.enrollment.updateMany({
    where: {
      id,
      schoolId,
      status: { in: [...allowedStatuses[action]] },
    },
    data: {
      status: nextStatus[action],
      ...(action === 'approve' ? { approvedAt: now } : {}),
      ...(action === 'withdraw' ? { withdrawnAt: now } : {}),
    },
  })
  if (result.count === 0) {
    const existing = await findEnrollmentById(database, schoolId, id)
    if (!existing) throw new EnrollmentNotFoundError()
    throw new InvalidEnrollmentTransitionError()
  }
  const enrollment = await findEnrollmentById(database, schoolId, id)
  if (!enrollment) throw new EnrollmentNotFoundError()
  return enrollment
}

export function submitEnrollment(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<Enrollment> {
  return applyTransition(database, schoolId, id, 'submit', new Date())
}

export function approveEnrollment(
  database: PrismaClient,
  schoolId: string,
  id: string,
  now: Date = new Date(),
): Promise<Enrollment> {
  return applyTransition(database, schoolId, id, 'approve', now)
}

export function withdrawEnrollment(
  database: PrismaClient,
  schoolId: string,
  id: string,
  now: Date = new Date(),
): Promise<Enrollment> {
  return applyTransition(database, schoolId, id, 'withdraw', now)
}
