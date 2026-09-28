import type { CourseworkAssignment, PrismaClient } from '@prisma/client'
import { findStudentAccessForUser } from './studentAccess.js'
import { mayManageClassSubject } from './teachingAssignments.js'
import { findSchoolMembership } from './schoolMemberships.js'

function approvedEnrollmentWhere(
  studentId: string,
  assignment: Pick<
    CourseworkAssignment,
    'schoolId' | 'academicYearId' | 'schoolClassId'
  >,
  now: Date,
) {
  return {
    studentId,
    schoolId: assignment.schoolId,
    academicYearId: assignment.academicYearId,
    schoolClassId: assignment.schoolClassId,
    status: 'approved' as const,
    withdrawnAt: null,
    OR: [{ approvedAt: null }, { approvedAt: { lte: now } }],
  }
}

export async function eligibleCourseworkEnrollment(
  database: PrismaClient,
  studentId: string,
  assignment: Pick<
    CourseworkAssignment,
    'schoolId' | 'academicYearId' | 'schoolClassId'
  >,
  now = new Date(),
) {
  return database.enrollment.findFirst({
    where: approvedEnrollmentWhere(studentId, assignment, now),
  })
}

export async function visibleCourseworkAssignmentForStudent(
  database: PrismaClient,
  actorId: string,
  assignmentId: string,
  now = new Date(),
) {
  const access = await findStudentAccessForUser(database, actorId)
  if (!access) return null
  const assignment = await database.courseworkAssignment.findFirst({
    where: { id: assignmentId, status: 'published' },
  })
  if (!assignment) return null
  const enrollment = await eligibleCourseworkEnrollment(
    database,
    access.studentId,
    assignment,
    now,
  )
  return enrollment
    ? { assignment, enrollment, studentId: access.studentId }
    : null
}

export async function listVisibleCourseworkAssignments(
  database: PrismaClient,
  actorId: string,
  now = new Date(),
) {
  const access = await findStudentAccessForUser(database, actorId)
  if (!access) return []
  const enrollments = await database.enrollment.findMany({
    where: {
      studentId: access.studentId,
      status: 'approved',
      withdrawnAt: null,
      schoolClassId: { not: null },
      OR: [{ approvedAt: null }, { approvedAt: { lte: now } }],
    },
    select: { schoolId: true, academicYearId: true, schoolClassId: true },
  })
  if (!enrollments.length) return []
  return database.courseworkAssignment.findMany({
    where: {
      status: 'published',
      OR: enrollments
        .filter((item) => item.schoolClassId)
        .map((item) => ({
          schoolId: item.schoolId,
          academicYearId: item.academicYearId,
          schoolClassId: item.schoolClassId!,
        })),
    },
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    take: 100,
  })
}

export async function mayManageCourseworkAssignment(
  database: PrismaClient,
  actorId: string,
  assignment: Pick<
    CourseworkAssignment,
    'schoolId' | 'academicYearId' | 'schoolClassId' | 'subjectId'
  >,
) {
  const membership = await findSchoolMembership(
    database,
    actorId,
    assignment.schoolId,
  )
  if (membership?.role === 'administrator') return true
  if (membership?.role !== 'teacher') return false
  return mayManageClassSubject(
    database,
    actorId,
    assignment.schoolId,
    assignment.academicYearId,
    assignment.schoolClassId,
    assignment.subjectId,
  )
}
