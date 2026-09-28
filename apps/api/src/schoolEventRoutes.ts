import { Buffer } from 'node:buffer'
import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  createSchoolEvent,
  editDraftSchoolEvent,
  EventAudienceSchema,
  eventResponseCounts,
  findSchoolMembership,
  hasActiveVerifiedGuardianRelationship,
  mayViewSchoolEvent,
  requireSchoolEventManager,
  respondToSchoolEvent,
  SchoolEventInputSchema,
  setEventRsvpEnabled,
  setSchoolEventAudience,
  transitionSchoolEvent,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'
import { eventAttachmentService } from './eventAttachmentService.js'

const school = z.strictObject({ schoolId: z.uuid() })
const eventParams = school.extend({ eventId: z.uuid() })
const attachmentParams = eventParams.extend({ attachmentId: z.uuid() })
const childParams = school.extend({ studentId: z.uuid() })
const childEventParams = childParams.extend({ eventId: z.uuid() })
const body = z.strictObject({
  title: SchoolEventInputSchema.shape.title,
  description: SchoolEventInputSchema.shape.description,
  startsAt: SchoolEventInputSchema.shape.startsAt,
  endsAt: SchoolEventInputSchema.shape.endsAt,
  schoolLocation: SchoolEventInputSchema.shape.schoolLocation,
})
const upload = z.strictObject({
  originalFileName: z.string().min(1).max(120),
  contentType: z.string().min(1).max(100),
  base64: z
    .string()
    .min(4)
    .max(28_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
})
const responseBody = z.strictObject({ status: z.enum(['going', 'notGoing']) })

export class SchoolEventRouteAccessError extends Error {}

export function registerSchoolEventRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (http: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(http).id
  async function guardianChild(
    actorId: string,
    schoolId: string,
    studentId: string,
  ) {
    const access = await getDatabase().guardianAccess.findUnique({
      where: { userId: actorId },
    })
    if (
      !access ||
      !(await hasActiveVerifiedGuardianRelationship(
        getDatabase(),
        schoolId,
        studentId,
        access.guardianId,
      ))
    )
      throw new SchoolEventRouteAccessError('Child events unavailable')
  }
  async function visible(
    eventId: string,
    schoolId: string,
    actorId: string,
    studentId?: string,
  ) {
    if (
      !(await mayViewSchoolEvent(
        getDatabase(),
        actorId,
        schoolId,
        eventId,
        studentId,
      ))
    )
      throw new SchoolEventRouteAccessError('Event unavailable')
    const event = await getDatabase().schoolEvent.findFirstOrThrow({
      where: { id: eventId, schoolId },
      select: {
        id: true,
        schoolId: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        schoolLocation: true,
        status: true,
        rsvpEnabled: true,
        attachments: {
          where: { removedAt: null },
          select: {
            id: true,
            fileAsset: {
              select: {
                originalFileName: true,
                status: true,
                scans: {
                  select: { result: true },
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  take: 1,
                },
              },
            },
          },
        },
      },
    })
    const response = await getDatabase().eventResponse.findUnique({
      where: {
        eventId_respondentUserId_subjectKey: {
          eventId,
          respondentUserId: actorId,
          subjectKey: studentId ? `child:${studentId}` : 'self',
        },
      },
      select: { status: true },
    })
    return {
      ...event,
      responseStatus: response?.status ?? null,
      attachments: event.attachments.map((attachment) => ({
        id: attachment.id,
        originalFileName: attachment.fileAsset.originalFileName,
        available:
          attachment.fileAsset.status === 'available' &&
          attachment.fileAsset.scans[0]?.result === 'clean',
      })),
    }
  }
  async function listVisible(
    actorId: string,
    schoolId: string,
    studentId?: string,
  ) {
    const candidates = await getDatabase().schoolEvent.findMany({
      where: { schoolId, status: { in: ['published', 'completed'] } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        status: true,
        rsvpEnabled: true,
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 100,
    })
    const checks = await Promise.all(
      candidates.map(async (event) => ({
        event,
        allowed: await mayViewSchoolEvent(
          getDatabase(),
          actorId,
          schoolId,
          event.id,
          studentId,
        ),
      })),
    )
    return {
      events: checks.filter((item) => item.allowed).map((item) => item.event),
    }
  }

  app.get(
    '/schools/:schoolId/events/admin',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId } = school.parse(http.params)
      await requireSchoolEventManager(getDatabase(), actor(http), schoolId)
      return {
        events: await getDatabase().schoolEvent.findMany({
          where: { schoolId },
          include: { audience: true },
          orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
          take: 100,
        }),
      }
    },
  )
  app.post(
    '/schools/:schoolId/events',
    { preHandler: authenticate },
    async (http, reply) => {
      const { schoolId } = school.parse(http.params)
      const created = await createSchoolEvent(getDatabase(), actor(http), {
        schoolId,
        ...body.parse(http.body),
      })
      return reply.code(201).send(created)
    },
  )
  app.put(
    '/schools/:schoolId/events/:eventId/draft',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      return editDraftSchoolEvent(
        getDatabase(),
        actor(http),
        schoolId,
        eventId,
        body.parse(http.body),
      )
    },
  )
  app.put(
    '/schools/:schoolId/events/:eventId/audience',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      return setSchoolEventAudience(
        getDatabase(),
        actor(http),
        schoolId,
        eventId,
        EventAudienceSchema.parse(http.body),
      )
    },
  )
  app.put(
    '/schools/:schoolId/events/:eventId/rsvp',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      const { enabled } = z
        .strictObject({ enabled: z.boolean() })
        .parse(http.body)
      return setEventRsvpEnabled(
        getDatabase(),
        actor(http),
        schoolId,
        eventId,
        enabled,
      )
    },
  )
  for (const action of ['publish', 'cancel', 'complete'] as const) {
    app.post(
      `/schools/:schoolId/events/:eventId/${action}`,
      { preHandler: authenticate },
      async (http) => {
        const { schoolId, eventId } = eventParams.parse(http.params)
        return transitionSchoolEvent(
          getDatabase(),
          actor(http),
          schoolId,
          eventId,
          action,
        )
      },
    )
  }
  app.post(
    '/schools/:schoolId/events/:eventId/attachments',
    { preHandler: authenticate },
    async (http, reply) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      const file = upload.parse(http.body)
      const created = await eventAttachmentService(getDatabase()).upload(
        actor(http),
        schoolId,
        eventId,
        {
          bytes: Buffer.from(file.base64, 'base64'),
          originalFileName: file.originalFileName,
          claimedContentType: file.contentType,
        },
      )
      return reply.code(201).send(created)
    },
  )
  app.get(
    '/schools/:schoolId/events/:eventId/attachments/admin',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      return {
        attachments: await eventAttachmentService(getDatabase()).list(
          actor(http),
          schoolId,
          eventId,
        ),
      }
    },
  )
  app.delete(
    '/schools/:schoolId/events/:eventId/attachments/:attachmentId',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId, attachmentId } = attachmentParams.parse(
        http.params,
      )
      return eventAttachmentService(getDatabase()).remove(
        actor(http),
        schoolId,
        eventId,
        attachmentId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/events/:eventId/responses/counts',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      await requireSchoolEventManager(getDatabase(), actor(http), schoolId)
      const event = await getDatabase().schoolEvent.findFirst({
        where: { id: eventId, schoolId },
      })
      if (!event) throw new SchoolEventRouteAccessError('Event unavailable')
      return eventResponseCounts(getDatabase(), schoolId, eventId)
    },
  )

  app.get(
    '/schools/:schoolId/events',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId } = school.parse(http.params)
      if (!(await findSchoolMembership(getDatabase(), actor(http), schoolId)))
        throw new SchoolEventRouteAccessError('Staff events unavailable')
      return listVisible(actor(http), schoolId)
    },
  )
  app.get(
    '/schools/:schoolId/events/:eventId',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      return visible(eventId, schoolId, actor(http))
    },
  )
  app.post(
    '/schools/:schoolId/events/:eventId/responses',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      return respondToSchoolEvent(
        getDatabase(),
        actor(http),
        schoolId,
        eventId,
        responseBody.parse(http.body).status,
      )
    },
  )
  app.get(
    '/student/schools/:schoolId/events',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId } = school.parse(http.params)
      if (
        !(await getDatabase().studentAccess.findUnique({
          where: { userId: actor(http) },
        }))
      )
        throw new SchoolEventRouteAccessError('Student events unavailable')
      return listVisible(actor(http), schoolId)
    },
  )
  app.get(
    '/student/schools/:schoolId/events/:eventId',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      return visible(eventId, schoolId, actor(http))
    },
  )
  app.post(
    '/student/schools/:schoolId/events/:eventId/responses',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, eventId } = eventParams.parse(http.params)
      if (
        !(await getDatabase().studentAccess.findUnique({
          where: { userId: actor(http) },
        }))
      )
        throw new SchoolEventRouteAccessError('Student events unavailable')
      return respondToSchoolEvent(
        getDatabase(),
        actor(http),
        schoolId,
        eventId,
        responseBody.parse(http.body).status,
      )
    },
  )
  app.get(
    '/parent/schools/:schoolId/children/:studentId/events',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, studentId } = childParams.parse(http.params)
      await guardianChild(actor(http), schoolId, studentId)
      return listVisible(actor(http), schoolId, studentId)
    },
  )
  app.get(
    '/parent/schools/:schoolId/children/:studentId/events/:eventId',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, studentId, eventId } = childEventParams.parse(
        http.params,
      )
      await guardianChild(actor(http), schoolId, studentId)
      return visible(eventId, schoolId, actor(http), studentId)
    },
  )
  app.post(
    '/parent/schools/:schoolId/children/:studentId/events/:eventId/responses',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, studentId, eventId } = childEventParams.parse(
        http.params,
      )
      await guardianChild(actor(http), schoolId, studentId)
      return respondToSchoolEvent(
        getDatabase(),
        actor(http),
        schoolId,
        eventId,
        responseBody.parse(http.body).status,
        studentId,
      )
    },
  )
}
