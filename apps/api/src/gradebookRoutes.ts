import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  MarkEntryWindowInputSchema,
  MarkModerationRequestSchema,
  ResultContextSchema,
  createMarkEntryWindow,
  findSchoolMembership,
  getGradebookCompleteness,
  getResultPublicationReadiness,
  hasOrganizationAdminRole,
  lockGradebook,
  mayManageClassSubject,
  previewResults,
  requestMarkModeration,
  reviewMarkModeration,
  transitionMarkEntryWindow,
  unlockGradebook,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const school = z.strictObject({ schoolId: z.uuid() })
const assessmentParams = school.extend({ assessmentId: z.uuid() })
const windowParams = school.extend({ windowId: z.uuid() })
const moderationParams = school.extend({ requestId: z.uuid() })
const contextQuery = ResultContextSchema.omit({ schoolId: true })

export function registerGradebookRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (request: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(request).id

  async function scope(
    actorId: string,
    schoolId: string,
    context?: z.infer<typeof contextQuery>,
  ) {
    const database = getDatabase()
    const found = await database.school.findUnique({
      where: { id: schoolId },
      select: { organizationId: true },
    })
    if (!found) return null
    if (await hasOrganizationAdminRole(database, actorId, found.organizationId))
      return 'administrator' as const
    const membership = await findSchoolMembership(database, actorId, schoolId)
    if (!membership) return null
    if (membership.role === 'administrator' || membership.role === 'approver')
      return membership.role
    if (membership.role !== 'teacher' || !context) return null
    const allowed = await mayManageClassSubject(
      database,
      actorId,
      schoolId,
      context.academicYearId,
      context.schoolClassId,
      context.subjectId,
    )
    return allowed ? ('teacher' as const) : null
  }

  async function assessmentScope(
    actorId: string,
    schoolId: string,
    assessmentId: string,
  ) {
    const assessment = await getDatabase().assessment.findFirst({
      where: { id: assessmentId, schoolId },
    })
    if (!assessment) return null
    const role = await scope(actorId, schoolId, assessment)
    return role ? { assessment, role } : null
  }

  app.get(
    '/schools/:schoolId/gradebook',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const context = contextQuery.parse(request.query)
      if (!(await scope(actor(request), schoolId, context)))
        return reply.code(403).send()
      return previewResults(getDatabase(), actor(request), {
        schoolId,
        ...context,
      })
    },
  )
  app.get(
    '/schools/:schoolId/gradebook/assessments/:assessmentId/completeness',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assessmentId } = assessmentParams.parse(request.params)
      if (!(await assessmentScope(actor(request), schoolId, assessmentId)))
        return reply.code(403).send()
      return getGradebookCompleteness(getDatabase(), schoolId, assessmentId)
    },
  )
  app.get(
    '/schools/:schoolId/gradebook/assessments/:assessmentId/participation',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assessmentId } = assessmentParams.parse(request.params)
      if (!(await assessmentScope(actor(request), schoolId, assessmentId)))
        return reply.code(403).send()
      return {
        records: await getDatabase().assessmentParticipation.findMany({
          where: { schoolId, session: { schedule: { assessmentId } } },
          select: {
            studentId: true,
            enrollmentId: true,
            status: true,
            makeUpAssessments: { select: { status: true } },
          },
        }),
      }
    },
  )
  app.get(
    '/schools/:schoolId/gradebook/assessments/:assessmentId/window',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assessmentId } = assessmentParams.parse(request.params)
      if (!(await assessmentScope(actor(request), schoolId, assessmentId)))
        return reply.code(403).send()
      return {
        window: await getDatabase().markEntryWindow.findFirst({
          where: { schoolId, assessmentId },
        }),
      }
    },
  )
  app.post(
    '/schools/:schoolId/gradebook/windows',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const body = z
        .strictObject(MarkEntryWindowInputSchema.shape)
        .omit({ schoolId: true })
        .parse(request.body)
      if (!(await assessmentScope(actor(request), schoolId, body.assessmentId)))
        return reply.code(403).send()
      return reply
        .code(201)
        .send(
          await createMarkEntryWindow(getDatabase(), actor(request), {
            schoolId,
            ...body,
          }),
        )
    },
  )
  app.post(
    '/schools/:schoolId/gradebook/windows/:windowId/:action',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, windowId, action } = windowParams
        .extend({ action: z.enum(['open', 'close']) })
        .parse(request.params)
      if (!(await scope(actor(request), schoolId)))
        return reply.code(403).send()
      return transitionMarkEntryWindow(
        getDatabase(),
        actor(request),
        schoolId,
        windowId,
        action,
      )
    },
  )
  app.get(
    '/schools/:schoolId/gradebook/moderation',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const context = contextQuery.parse(request.query)
      if (!(await scope(actor(request), schoolId, context)))
        return reply.code(403).send()
      return {
        requests: await getDatabase().markModerationRequest.findMany({
          where: { schoolId, mark: { assessment: context } },
          include: { correction: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      }
    },
  )
  app.post(
    '/schools/:schoolId/gradebook/moderation',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const body = MarkModerationRequestSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      const mark = await getDatabase().mark.findFirst({
        where: { id: body.markId, schoolId },
        select: { assessmentId: true },
      })
      if (
        !mark ||
        !(await assessmentScope(actor(request), schoolId, mark.assessmentId))
      )
        return reply.code(403).send()
      return reply
        .code(201)
        .send(
          await requestMarkModeration(getDatabase(), actor(request), {
            schoolId,
            ...body,
          }),
        )
    },
  )
  app.post(
    '/schools/:schoolId/gradebook/moderation/:requestId/review',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, requestId } = moderationParams.parse(request.params)
      const { decision } = z
        .strictObject({ decision: z.enum(['approved', 'rejected']) })
        .parse(request.body)
      const role = await scope(actor(request), schoolId)
      if (role !== 'administrator' && role !== 'approver')
        return reply.code(403).send()
      return reviewMarkModeration(
        getDatabase(),
        actor(request),
        schoolId,
        requestId,
        decision,
      )
    },
  )
  app.post(
    '/schools/:schoolId/gradebook/lock',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const context = contextQuery.parse(request.body)
      if ((await scope(actor(request), schoolId)) !== 'administrator')
        return reply.code(403).send()
      return lockGradebook(getDatabase(), actor(request), {
        schoolId,
        ...context,
      })
    },
  )
  app.post(
    '/schools/:schoolId/gradebook/unlock',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const { reason, ...context } = contextQuery
        .extend({ reason: z.string().trim().min(5).max(500) })
        .parse(request.body)
      if ((await scope(actor(request), schoolId)) !== 'administrator')
        return reply.code(403).send()
      return unlockGradebook(
        getDatabase(),
        actor(request),
        { schoolId, ...context },
        reason,
      )
    },
  )
  app.get(
    '/schools/:schoolId/gradebook/readiness',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const context = contextQuery.parse(request.query)
      if (!(await scope(actor(request), schoolId, context)))
        return reply.code(403).send()
      return getResultPublicationReadiness(getDatabase(), actor(request), {
        schoolId,
        ...context,
      })
    },
  )
}
