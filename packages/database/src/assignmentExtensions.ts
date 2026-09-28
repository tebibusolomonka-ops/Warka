import type { CourseworkAssignment, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  eligibleCourseworkEnrollment,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import { findStudentAccessForUser } from './studentAccess.js'

export class AssignmentExtensionError extends Error {}
export const GrantAssignmentExtensionSchema = z.strictObject({
  studentId: z.uuid(),
  extendedDueAt: z.iso.datetime({ offset: true }),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !/<[^>]+>/.test(value), 'HTML is not accepted'),
})

export async function effectiveCourseworkDueAt(
  database: PrismaClient,
  assignment: Pick<CourseworkAssignment, 'id' | 'dueAt'>,
  studentId: string,
) {
  const extension = await database.assignmentExtension.findFirst({
    where: { assignmentId: assignment.id, studentId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  return extension?.extendedDueAt ?? assignment.dueAt
}

export async function grantAssignmentExtension(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  input: unknown,
  now = new Date(),
) {
  const value = GrantAssignmentExtensionSchema.parse(input)
  const assignment = await database.courseworkAssignment.findFirst({
    where: { id: assignmentId, schoolId, status: 'published' },
  })
  if (
    !assignment ||
    !(await mayManageCourseworkAssignment(database, actorId, assignment))
  )
    throw new AssignmentExtensionError('Assignment management required')
  const self = await findStudentAccessForUser(database, actorId)
  if (self?.studentId === value.studentId)
    throw new AssignmentExtensionError('Student cannot grant own extension')
  const enrollment = await eligibleCourseworkEnrollment(
    database,
    value.studentId,
    assignment,
    now,
  )
  if (!enrollment)
    throw new AssignmentExtensionError(
      'Student is outside the assignment audience',
    )
  const priorDueAt = await effectiveCourseworkDueAt(
    database,
    assignment,
    value.studentId,
  )
  const extendedDueAt = new Date(value.extendedDueAt)
  if (extendedDueAt <= priorDueAt || extendedDueAt <= now)
    throw new AssignmentExtensionError(
      'Extension must be later than current effective due time',
    )
  return database.assignmentExtension.create({
    data: {
      schoolId,
      assignmentId,
      studentId: value.studentId,
      enrollmentId: enrollment.id,
      originalDueAt: assignment.dueAt,
      extendedDueAt,
      reason: value.reason,
      createdById: actorId,
    },
  })
}
