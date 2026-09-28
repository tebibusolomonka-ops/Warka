import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  CreateCourseworkAssignmentSchema,
  createCourseworkAssignment,
  editCourseworkDraft,
  publishCourseworkAssignment,
  endCourseworkAssignment,
  changePublishedCourseworkDueDate,
  grantAssignmentExtension,
  mayManageCourseworkAssignment,
  listVisibleCourseworkAssignments,
  visibleCourseworkAssignmentForStudent,
  effectiveCourseworkDueAt,
  startCourseworkSubmission,
  ownCourseworkSubmission,
  saveDraftSubmissionRevision,
  submitCourseworkRevision,
  withdrawCourseworkSubmission,
  listOwnSubmissionRevisions,
  listCourseworkSubmissionsForStaff,
  findSchoolMembership,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'
import { courseworkAttachmentService } from './courseworkAttachmentService.js'
import { submissionAttachmentService } from './submissionAttachmentService.js'

export class CourseworkRouteAccessError extends Error {}

const school = z.strictObject({ schoolId: z.uuid() })
const assignment = school.extend({ assignmentId: z.uuid() })
const studentAssignment = z.strictObject({ assignmentId: z.uuid() })
const attachment = assignment.extend({ attachmentId: z.uuid() })
const revision = studentAssignment.extend({ revisionId: z.uuid() })
const submissionAttachment = revision.extend({ attachmentId: z.uuid() })
const upload = z.strictObject({
  originalFileName: z.string().min(1).max(120),
  contentType: z.string().min(1).max(100),
  base64: z
    .string()
    .min(4)
    .max(28_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
})
const page = z.strictObject({
  take: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.uuid().optional(),
})

export function registerCourseworkRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (request: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(request).id
  const db = getDatabase
  async function staffAssignment(
    actorId: string,
    schoolId: string,
    assignmentId: string,
  ) {
    const row = await db().courseworkAssignment.findFirst({
      where: { id: assignmentId, schoolId },
    })
    if (!row || !(await mayManageCourseworkAssignment(db(), actorId, row)))
      throw new CourseworkRouteAccessError('Assignment not found')
    return row
  }

  app.post(
    '/schools/:schoolId/coursework',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const body = CreateCourseworkAssignmentSchema.omit({
        schoolId: true,
      }).parse(request.body)
      return reply.code(201).send(
        await createCourseworkAssignment(db(), actor(request), {
          ...body,
          schoolId,
        }),
      )
    },
  )
  app.get(
    '/schools/:schoolId/coursework',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      const { take, cursor } = page.parse(request.query)
      const membership = await findSchoolMembership(
        db(),
        actor(request),
        schoolId,
      )
      if (
        !membership ||
        !['teacher', 'administrator'].includes(membership.role)
      )
        throw new CourseworkRouteAccessError(
          'School coursework access required',
        )
      const rows = await db().courseworkAssignment.findMany({
        where: { schoolId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take ?? 50,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      const allowed = await Promise.all(
        rows.map(async (row) =>
          (await mayManageCourseworkAssignment(db(), actor(request), row))
            ? row
            : null,
        ),
      )
      return {
        assignments: allowed.filter((row) => row !== null),
        nextCursor: rows.length === (take ?? 50) ? rows.at(-1)?.id : null,
      }
    },
  )
  app.get(
    '/schools/:schoolId/coursework/:assignmentId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const row = await staffAssignment(actor(request), schoolId, assignmentId)
      const attachments = await courseworkAttachmentService(db()).list(
        actor(request),
        schoolId,
        assignmentId,
      )
      return { assignment: row, attachments }
    },
  )
  app.patch(
    '/schools/:schoolId/coursework/:assignmentId/draft',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return editCourseworkDraft(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        request.body,
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/publish',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return publishCourseworkAssignment(
        db(),
        actor(request),
        schoolId,
        assignmentId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/close',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return endCourseworkAssignment(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        'close',
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/cancel',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return endCourseworkAssignment(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        'cancel',
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/due-date',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const body = z
        .strictObject({
          dueAt: z.iso.datetime({ offset: true }),
          reason: z.string().min(1).max(500),
        })
        .parse(request.body)
      return changePublishedCourseworkDueDate(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        body,
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/attachments',
    { preHandler: authenticate, bodyLimit: 28 * 1024 * 1024 },
    async (request, reply) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const body = upload.parse(request.body)
      return reply.code(201).send(
        await courseworkAttachmentService(db()).upload(
          actor(request),
          schoolId,
          assignmentId,
          {
            bytes: Buffer.from(body.base64, 'base64'),
            originalFileName: body.originalFileName,
            claimedContentType: body.contentType,
          },
        ),
      )
    },
  )
  app.delete(
    '/schools/:schoolId/coursework/:assignmentId/attachments/:attachmentId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId, attachmentId } = attachment.parse(
        request.params,
      )
      return courseworkAttachmentService(db()).remove(
        actor(request),
        schoolId,
        assignmentId,
        attachmentId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/coursework/:assignmentId/submissions',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const { take, cursor } = page.parse(request.query)
      return {
        submissions: await listCourseworkSubmissionsForStaff(
          db(),
          actor(request),
          schoolId,
          assignmentId,
          take,
          cursor,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/extensions',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return reply
        .code(201)
        .send(
          await grantAssignmentExtension(
            db(),
            actor(request),
            schoolId,
            assignmentId,
            request.body,
          ),
        )
    },
  )

  app.get(
    '/student/coursework',
    { preHandler: authenticate },
    async (request) => ({
      assignments: await listVisibleCourseworkAssignments(db(), actor(request)),
    }),
  )
  app.get(
    '/student/coursework/:assignmentId',
    { preHandler: authenticate },
    async (request) => {
      const { assignmentId } = studentAssignment.parse(request.params)
      const audience = await visibleCourseworkAssignmentForStudent(
        db(),
        actor(request),
        assignmentId,
      )
      if (!audience)
        throw new CourseworkRouteAccessError('Assignment not found')
      const attachments = await db().courseworkAttachment.findMany({
        where: { assignmentId, removedAt: null },
        select: {
          id: true,
          fileAsset: {
            select: {
              originalFileName: true,
              contentType: true,
              sizeBytes: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      const submission = await ownCourseworkSubmission(
        db(),
        actor(request),
        assignmentId,
      )
      return {
        assignment: audience.assignment,
        effectiveDueAt: await effectiveCourseworkDueAt(
          db(),
          audience.assignment,
          audience.studentId,
        ),
        attachments: attachments.map((item) => ({
          id: item.id,
          originalFileName: item.fileAsset.originalFileName,
          contentType: item.fileAsset.contentType,
          sizeBytes: item.fileAsset.sizeBytes.toString(),
          status: item.fileAsset.status,
        })),
        submission,
      }
    },
  )
  app.post(
    '/student/coursework/:assignmentId/submission',
    { preHandler: authenticate },
    async (request, reply) => {
      const { assignmentId } = studentAssignment.parse(request.params)
      z.strictObject({}).parse(request.body ?? {})
      return reply
        .code(201)
        .send(
          await startCourseworkSubmission(db(), actor(request), assignmentId),
        )
    },
  )
  app.get(
    '/student/coursework/:assignmentId/submission',
    { preHandler: authenticate },
    async (request) => {
      const { assignmentId } = studentAssignment.parse(request.params)
      return {
        submission: await ownCourseworkSubmission(
          db(),
          actor(request),
          assignmentId,
        ),
        revisions: await listOwnSubmissionRevisions(
          db(),
          actor(request),
          assignmentId,
        ),
      }
    },
  )
  app.put(
    '/student/coursework/:assignmentId/submission/draft',
    { preHandler: authenticate },
    async (request) => {
      const { assignmentId } = studentAssignment.parse(request.params)
      const { textResponse } = z
        .strictObject({ textResponse: z.string().max(20000) })
        .parse(request.body)
      return saveDraftSubmissionRevision(
        db(),
        actor(request),
        assignmentId,
        textResponse,
      )
    },
  )
  app.post(
    '/student/coursework/:assignmentId/submission/submit',
    { preHandler: authenticate },
    async (request) => {
      const { assignmentId } = studentAssignment.parse(request.params)
      return submitCourseworkRevision(db(), actor(request), assignmentId)
    },
  )
  app.post(
    '/student/coursework/:assignmentId/submission/withdraw',
    { preHandler: authenticate },
    async (request) => {
      const { assignmentId } = studentAssignment.parse(request.params)
      return withdrawCourseworkSubmission(db(), actor(request), assignmentId)
    },
  )
  app.post(
    '/student/coursework/:assignmentId/revisions/:revisionId/attachments',
    { preHandler: authenticate, bodyLimit: 28 * 1024 * 1024 },
    async (request, reply) => {
      const { assignmentId, revisionId } = revision.parse(request.params)
      const body = upload.parse(request.body)
      const audience = await visibleCourseworkAssignmentForStudent(
        db(),
        actor(request),
        assignmentId,
      )
      if (!audience)
        throw new CourseworkRouteAccessError('Assignment not found')
      return reply.code(201).send(
        await submissionAttachmentService(db()).upload(
          actor(request),
          audience.assignment.schoolId,
          assignmentId,
          revisionId,
          {
            bytes: Buffer.from(body.base64, 'base64'),
            originalFileName: body.originalFileName,
            claimedContentType: body.contentType,
          },
        ),
      )
    },
  )
  app.delete(
    '/student/coursework/:assignmentId/revisions/:revisionId/attachments/:attachmentId',
    { preHandler: authenticate },
    async (request) => {
      const { assignmentId, revisionId, attachmentId } =
        submissionAttachment.parse(request.params)
      const audience = await visibleCourseworkAssignmentForStudent(
        db(),
        actor(request),
        assignmentId,
      )
      if (!audience)
        throw new CourseworkRouteAccessError('Assignment not found')
      return submissionAttachmentService(db()).remove(
        actor(request),
        audience.assignment.schoolId,
        assignmentId,
        revisionId,
        attachmentId,
      )
    },
  )
}
