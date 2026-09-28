import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { findStudentAccessForUser, type PrismaClient } from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import { eligibleParentChildren } from './parentPortalService.js'

async function summary(
  database: PrismaClient,
  studentId: string,
  schoolId?: string,
  now = new Date(),
) {
  const day = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const enrollments = await database.enrollment.findMany({
    where: {
      studentId,
      status: 'approved',
      ...(schoolId ? { schoolId } : {}),
      academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
    },
    select: {
      id: true,
      schoolId: true,
      academicYearId: true,
      schoolClassId: true,
    },
  })
  const [published, completed] = await Promise.all([
    database.publishedResult.findMany({
      where: {
        studentId,
        ...(schoolId ? { schoolId } : {}),
        resultSet: { status: 'published', publishedAt: { not: null } },
      },
      select: {
        resultSet: { select: { subject: { select: { name: true } } } },
      },
    }),
    database.assessmentParticipation.count({
      where: {
        studentId,
        status: 'present',
        session: { status: 'completed' },
        enrollmentId: { in: enrollments.map((item) => item.id) },
      },
    }),
  ])
  const classEnrollments = enrollments.filter((item) => item.schoolClassId)
  const schedules = classEnrollments.length
    ? await database.assessmentSchedule.findMany({
        where: {
          status: 'scheduled',
          scheduledDate: { gte: day },
          OR: classEnrollments.map((item) => ({
            schoolId: item.schoolId,
            academicYearId: item.academicYearId,
            schoolClassId: item.schoolClassId!,
          })),
        },
        select: {
          id: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          assessment: { select: { name: true } },
          subject: { select: { name: true } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
        take: 20,
      })
    : []
  return {
    completedAssessments: completed,
    publishedResultsAvailable: published.length,
    subjectsWithPublishedResults: [
      ...new Set(published.map((item) => item.resultSet.subject.name)),
    ].sort(),
    upcomingAssessments: schedules.map((item) => ({
      id: item.id,
      name: item.assessment.name,
      subject: item.subject.name,
      date: item.scheduledDate.toISOString().slice(0, 10),
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  }
}

export function registerAcademicProgressRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/student/progress',
    { preHandler: authenticate },
    async (request, reply) => {
      const database = getDatabase()
      const access = await findStudentAccessForUser(
        database,
        authenticatedUser(request).id,
      )
      if (!access) return reply.code(403).send()
      return summary(database, access.studentId)
    },
  )
  app.get(
    '/parent/children/:studentReference/progress',
    { preHandler: authenticate },
    async (request, reply) => {
      const { studentReference } = z
        .strictObject({ studentReference: z.string().min(1).max(100) })
        .parse(request.params)
      const database = getDatabase()
      const children = await eligibleParentChildren(
        database,
        authenticatedUser(request).id,
      )
      const child = children.find(
        (item) => item.studentReference === studentReference,
      )
      if (!child) return reply.code(403).send()
      return summary(database, child.studentId, child.schoolId)
    },
  )
}
