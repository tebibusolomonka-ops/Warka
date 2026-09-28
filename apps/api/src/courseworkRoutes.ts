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
  editableCourseworkDueAt,
  completeSubmissionReview,
  createCourseworkRubric,
  replaceCourseworkRubric,
  cloneCourseworkRubric,
  getCourseworkRubric,
  scoreSubmissionRubric,
  saveDraftCourseworkFeedback,
  releaseCourseworkFeedback,
  startCourseworkSubmission,
  ownCourseworkSubmission,
  saveDraftSubmissionRevision,
  submitCourseworkRevision,
  withdrawCourseworkSubmission,
  listOwnSubmissionRevisions,
  listCourseworkSubmissionsForStaff,
  findSchoolMembership,
  findStudentAccessForUser,
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
const staffSubmission = assignment.extend({ submissionId: z.uuid() })
const staffRevision = assignment.extend({ revisionId: z.uuid() })
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
  app.get(
    '/schools/:schoolId/coursework/:assignmentId/submissions/:submissionId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId, submissionId } = staffSubmission.parse(
        request.params,
      )
      await staffAssignment(actor(request), schoolId, assignmentId)
      const row = await db().courseworkSubmission.findFirst({
        where: { id: submissionId, schoolId, assignmentId },
        include: {
          student: {
            select: {
              studentReference: true,
              givenName: true,
              familyName: true,
            },
          },
          revisions: {
            where: { submittedAt: { not: null } },
            orderBy: { revisionNumber: 'desc' },
            include: {
              review: true,
              feedback: true,
              rubricScores: {
                orderBy: { version: 'desc' },
                take: 1,
                include: { criteria: true },
              },
              attachments: {
                where: { removedAt: null },
                select: {
                  id: true,
                  fileAsset: {
                    select: { originalFileName: true, status: true },
                  },
                },
              },
            },
          },
        },
      })
      if (!row) throw new CourseworkRouteAccessError('Submission not found')
      return row
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/revisions/:revisionId/review',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId, revisionId } = staffRevision.parse(
        request.params,
      )
      return completeSubmissionReview(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        revisionId,
        request.body,
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/revisions/:revisionId/rubric-scores',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assignmentId, revisionId } = staffRevision.parse(
        request.params,
      )
      return reply
        .code(201)
        .send(
          await scoreSubmissionRubric(
            db(),
            actor(request),
            schoolId,
            assignmentId,
            revisionId,
            request.body,
          ),
        )
    },
  )
  app.put(
    '/schools/:schoolId/coursework/:assignmentId/revisions/:revisionId/feedback',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId, revisionId } = staffRevision.parse(
        request.params,
      )
      const { text } = z
        .strictObject({ text: z.string().min(1).max(10000) })
        .parse(request.body)
      return saveDraftCourseworkFeedback(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        revisionId,
        text,
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/revisions/:revisionId/feedback/release',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId, revisionId } = staffRevision.parse(
        request.params,
      )
      return releaseCourseworkFeedback(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        revisionId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/coursework/:assignmentId/audience',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const row = await staffAssignment(actor(request), schoolId, assignmentId)
      const enrollments = await db().enrollment.findMany({
        where: {
          schoolId,
          academicYearId: row.academicYearId,
          schoolClassId: row.schoolClassId,
          status: 'approved',
          withdrawnAt: null,
          OR: [{ approvedAt: null }, { approvedAt: { lte: new Date() } }],
        },
        select: {
          id: true,
          studentId: true,
          student: {
            select: {
              studentReference: true,
              givenName: true,
              familyName: true,
            },
          },
        },
        orderBy: { student: { givenName: 'asc' } },
      })
      return {
        students: enrollments.map((item) => ({
          studentId: item.studentId,
          studentReference: item.student.studentReference,
          name: [item.student.givenName, item.student.familyName]
            .filter(Boolean)
            .join(' '),
        })),
      }
    },
  )
  app.get(
    '/schools/:schoolId/coursework/:assignmentId/counts',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const row = await staffAssignment(actor(request), schoolId, assignmentId)
      const now = new Date()
      const enrollments = await db().enrollment.findMany({
        where: {
          schoolId,
          academicYearId: row.academicYearId,
          schoolClassId: row.schoolClassId,
          status: 'approved',
          withdrawnAt: null,
          OR: [{ approvedAt: null }, { approvedAt: { lte: now } }],
        },
        select: { studentId: true },
      })
      const studentIds = enrollments.map((item) => item.studentId)
      const submissions = await db().courseworkSubmission.findMany({
        where: {
          assignmentId,
          studentId: { in: studentIds },
          status: 'submitted',
        },
        select: { studentId: true, submittedAt: true },
      })
      let late = 0
      for (const item of submissions)
        if (
          item.submittedAt &&
          item.submittedAt >
            (await effectiveCourseworkDueAt(db(), row, item.studentId))
        )
          late++
      return {
        assigned: studentIds.length,
        submitted: submissions.length,
        notSubmitted: Math.max(0, studentIds.length - submissions.length),
        late,
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
    '/schools/:schoolId/coursework/:assignmentId/rubric',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      await staffAssignment(actor(request), schoolId, assignmentId)
      return { rubric: await getCourseworkRubric(db(), assignmentId) }
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/rubric',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return reply
        .code(201)
        .send(
          await createCourseworkRubric(
            db(),
            actor(request),
            schoolId,
            assignmentId,
            request.body,
          ),
        )
    },
  )
  app.put(
    '/schools/:schoolId/coursework/:assignmentId/rubric',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      return replaceCourseworkRubric(
        db(),
        actor(request),
        schoolId,
        assignmentId,
        request.body,
      )
    },
  )
  app.post(
    '/schools/:schoolId/coursework/:assignmentId/rubric/clone',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, assignmentId } = assignment.parse(request.params)
      const { sourceAssignmentId } = z
        .strictObject({ sourceAssignmentId: z.uuid() })
        .parse(request.body)
      return reply
        .code(201)
        .send(
          await cloneCourseworkRubric(
            db(),
            actor(request),
            schoolId,
            sourceAssignmentId,
            assignmentId,
          ),
        )
    },
  )

  app.get(
    '/student/coursework',
    { preHandler: authenticate },
    async (request) => {
      const rows = await listVisibleCourseworkAssignments(db(), actor(request))
      const access = await findStudentAccessForUser(db(), actor(request))
      if (!access) return { assignments: [] }
      return {
        assignments: await Promise.all(
          rows.map(async (row) => ({
            ...row,
            effectiveDueAt: await effectiveCourseworkDueAt(
              db(),
              row,
              access.studentId,
            ),
          })),
        ),
      }
    },
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
      const [schoolClass, subject, teacher] = await Promise.all([
        db().schoolClass.findUnique({
          where: { id: audience.assignment.schoolClassId },
          select: { name: true },
        }),
        db().subject.findUnique({
          where: { id: audience.assignment.subjectId },
          select: { name: true },
        }),
        db().user.findUnique({
          where: { id: audience.assignment.createdById },
          select: { displayName: true },
        }),
      ])
      return {
        assignment: audience.assignment,
        context: {
          className: schoolClass?.name ?? 'Class',
          subjectName: subject?.name ?? 'Subject',
          teacherName: teacher?.displayName ?? 'Teacher',
        },
        effectiveDueAt: await effectiveCourseworkDueAt(
          db(),
          audience.assignment,
          audience.studentId,
        ),
        editableUntil: await editableCourseworkDueAt(
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
        rubric: await getCourseworkRubric(db(), assignmentId),
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
