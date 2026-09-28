import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  visibleCourseworkAssignmentForStudent,
  mayManageCourseworkAssignment,
} from './courseworkAudience.js'
import { effectiveCourseworkDueAt } from './assignmentExtensions.js'

export class CourseworkSubmissionAccessError extends Error {}

export async function startCourseworkSubmission(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  now = new Date(),
) {
  z.uuid().parse(actorId)
  z.uuid().parse(assignmentId)
  const audience = await visibleCourseworkAssignmentForStudent(
    database,
    actorId,
    assignmentId,
    now,
  )
  if (
    !audience ||
    audience.assignment.status !== 'published' ||
    (await effectiveCourseworkDueAt(
      database,
      audience.assignment,
      audience.studentId,
    )) < now
  )
    throw new CourseworkSubmissionAccessError(
      'Assignment is not open to this student',
    )
  try {
    return await database.courseworkSubmission.create({
      data: {
        schoolId: audience.assignment.schoolId,
        assignmentId,
        studentId: audience.studentId,
        enrollmentId: audience.enrollment.id,
        startedAt: now,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await database.courseworkSubmission.findUniqueOrThrow({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: audience.studentId,
          },
        },
      })
      if (existing.status === 'withdrawn')
        return database.courseworkSubmission.update({
          where: { id: existing.id },
          data: {
            status: 'draft',
            submittedAt: null,
            enrollmentId: audience.enrollment.id,
          },
        })
      return existing
    }
    throw error
  }
}

export async function ownCourseworkSubmission(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
) {
  const audience = await visibleCourseworkAssignmentForStudent(
    database,
    actorId,
    assignmentId,
  )
  if (!audience)
    throw new CourseworkSubmissionAccessError(
      'Assignment is not visible to this student',
    )
  return database.courseworkSubmission.findUnique({
    where: {
      assignmentId_studentId: { assignmentId, studentId: audience.studentId },
    },
  })
}

export async function listCourseworkSubmissionsForStaff(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  assignmentId: string,
  take = 50,
  cursor?: string,
) {
  const assignment = await database.courseworkAssignment.findFirst({
    where: { id: assignmentId, schoolId },
  })
  if (
    !assignment ||
    !(await mayManageCourseworkAssignment(database, actorId, assignment))
  )
    throw new CourseworkSubmissionAccessError('Assignment access required')
  return database.courseworkSubmission.findMany({
    where: { schoolId, assignmentId },
    orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    take: Math.min(Math.max(take, 1), 100),
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })
}
