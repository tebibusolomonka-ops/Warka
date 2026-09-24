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

type EnrollmentStore = Pick<
  PrismaClient,
  'academicYear' | 'gradeLevel' | 'schoolClass' | 'enrollment'
>

export type CreateEnrollment = z.input<typeof CreateEnrollmentSchema>
export type EnrollmentAction = 'submit' | 'approve' | 'withdraw'

const allowedStatuses: Record<EnrollmentAction, readonly EnrollmentStatus[]> = {
  submit: ['draft'],
  approve: ['pending'],
  withdraw: ['draft', 'pending', 'approved'],
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
  database: EnrollmentStore,
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
  database: EnrollmentStore,
  schoolId: string,
  id: string,
): Promise<Enrollment | null> {
  return database.enrollment.findFirst({ where: { id, schoolId } })
}

async function applyTransition(
  database: EnrollmentStore,
  schoolId: string,
  id: string,
  action: EnrollmentAction,
  now: Date,
  actorId?: string,
): Promise<Enrollment> {
  const data: Prisma.EnrollmentUncheckedUpdateManyInput =
    action === 'submit'
      ? { status: 'pending' }
      : action === 'approve'
        ? {
            status: 'approved',
            approvedAt: now,
            approvedById: z.uuid().parse(actorId),
          }
        : {
            status: 'withdrawn',
            withdrawnAt: now,
            withdrawnById: z.uuid().parse(actorId),
          }
  const result = await database.enrollment.updateMany({
    where: {
      id,
      schoolId,
      status: { in: [...allowedStatuses[action]] },
    },
    data,
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
  database: EnrollmentStore,
  schoolId: string,
  id: string,
): Promise<Enrollment> {
  return applyTransition(database, schoolId, id, 'submit', new Date())
}

export function approveEnrollment(
  database: EnrollmentStore,
  schoolId: string,
  id: string,
  userId: string,
  now: Date = new Date(),
): Promise<Enrollment> {
  z.uuid().parse(userId)
  return applyTransition(database, schoolId, id, 'approve', now, userId)
}

export function withdrawEnrollment(
  database: EnrollmentStore,
  schoolId: string,
  id: string,
  userId: string,
  now: Date = new Date(),
): Promise<Enrollment> {
  z.uuid().parse(userId)
  return applyTransition(database, schoolId, id, 'withdraw', now, userId)
}
