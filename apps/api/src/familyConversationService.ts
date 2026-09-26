import type { FamilyConversation, PrismaClient } from '@warka/database'
import { createNotifications, hasOrganizationAdminRole } from '@warka/database'
import { z } from 'zod'
import {
  eligibleParentChildren,
  resolveParentGuardian,
} from './parentPortalService.js'

export const FamilyMessageBodySchema = z.string().trim().min(1).max(5000)
export const CreateFamilyConversationSchema = z.strictObject({
  studentReference: z.string().min(1).max(100),
  route: z.enum(['teacher', 'schoolOffice']),
  teacherUserId: z.uuid().optional(),
  body: FamilyMessageBodySchema,
})

export class FamilyConversationAccessError extends Error {
  constructor() {
    super('Family conversation is unavailable')
  }
}

export class FamilyConversationStateError extends Error {
  constructor() {
    super('Family conversation is closed')
  }
}

const pageSchema = z.strictObject({
  limit: z.number().int().min(1).max(50),
  offset: z.number().int().min(0),
})

export function prismaFamilyConversationService(database: PrismaClient) {
  async function child(userId: string, reference: string) {
    const children = await eligibleParentChildren(database, userId)
    const found = children.find((item) => item.studentReference === reference)
    if (!found) throw new FamilyConversationAccessError()
    return found
  }

  async function staffRole(actorId: string, schoolId: string) {
    const school = await database.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new FamilyConversationAccessError()
    if (
      await hasOrganizationAdminRole(database, actorId, school.organizationId)
    )
      return 'leadership' as const
    const member = await database.schoolMembership.findUnique({
      where: { userId_schoolId: { userId: actorId, schoolId } },
    })
    return member?.role ?? null
  }

  async function currentTeacher(conversation: FamilyConversation) {
    if (!conversation.teacherUserId) return false
    const day = new Date(
      new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
    )
    const enrollment = await database.enrollment.findFirst({
      where: {
        studentId: conversation.studentId,
        schoolId: conversation.schoolId,
        status: 'approved',
        academicYear: {
          startsOn: { lte: day },
          endsOn: { gte: day },
        },
      },
    })
    if (!enrollment?.schoolClassId) return false
    return !!(await database.teachingAssignment.findFirst({
      where: {
        userId: conversation.teacherUserId,
        schoolId: conversation.schoolId,
        academicYearId: enrollment.academicYearId,
        schoolClassId: enrollment.schoolClassId,
      },
    }))
  }

  async function canStaffRead(
    actorId: string,
    conversation: FamilyConversation,
  ) {
    const role = await staffRole(actorId, conversation.schoolId)
    if (conversation.route === 'teacher') {
      return (
        (role === 'teacher' && conversation.teacherUserId === actorId) ||
        (!!conversation.escalatedAt &&
          (role === 'administrator' || role === 'leadership'))
      )
    }
    return (
      role === 'administrator' || role === 'registrar' || role === 'leadership'
    )
  }

  async function canGuardianRead(
    actorId: string,
    conversation: FamilyConversation,
  ) {
    const guardian = await database.guardianAccess.findUnique({
      where: { userId: actorId },
    })
    if (!guardian || guardian.guardianId !== conversation.guardianId)
      return false
    const children = await eligibleParentChildren(database, actorId)
    return children.some(
      (item) =>
        item.studentId === conversation.studentId &&
        item.schoolId === conversation.schoolId,
    )
  }

  async function requireConversation(actorId: string, conversationId: string) {
    const conversation = await database.familyConversation.findUnique({
      where: { id: conversationId },
    })
    if (!conversation) throw new FamilyConversationAccessError()
    const guardian = await canGuardianRead(actorId, conversation)
    const staff = guardian ? false : await canStaffRead(actorId, conversation)
    if (!guardian && !staff) throw new FamilyConversationAccessError()
    return { conversation, guardian, staff }
  }

  return {
    async teacherContacts(userId: string, studentReference: string) {
      const target = await child(userId, studentReference)
      if (!target.schoolClassId) return []
      const assignments = await database.teachingAssignment.findMany({
        where: {
          schoolId: target.schoolId,
          academicYearId: target.academicYearId,
          schoolClassId: target.schoolClassId,
          user: {
            schoolMemberships: {
              some: { schoolId: target.schoolId, role: 'teacher' },
            },
          },
        },
        include: {
          user: { select: { id: true, displayName: true } },
          subject: { select: { name: true } },
        },
        orderBy: [
          { user: { displayName: 'asc' } },
          { subject: { name: 'asc' } },
        ],
      })
      return assignments.map((assignment) => ({
        id: assignment.user.id,
        displayName: assignment.user.displayName,
        subject: assignment.subject.name,
      }))
    },
    async create(
      actorId: string,
      input: z.input<typeof CreateFamilyConversationSchema>,
    ) {
      const data = CreateFamilyConversationSchema.parse(input)
      const target = await child(actorId, data.studentReference)
      if (data.route === 'teacher') {
        if (!data.teacherUserId || !target.schoolClassId)
          throw new FamilyConversationAccessError()
        const contacts = await this.teacherContacts(
          actorId,
          data.studentReference,
        )
        if (!contacts.some((item) => item.id === data.teacherUserId))
          throw new FamilyConversationAccessError()
      } else if (data.teacherUserId) throw new FamilyConversationAccessError()
      return database.$transaction(async (transaction) => {
        const conversation = await transaction.familyConversation.create({
          data: {
            schoolId: target.schoolId,
            studentId: target.studentId,
            guardianId: target.guardianId,
            route: data.route,
            teacherUserId:
              data.route === 'teacher' ? data.teacherUserId! : null,
          },
        })
        await transaction.familyMessage.create({
          data: {
            conversationId: conversation.id,
            senderUserId: actorId,
            senderKind: 'guardian',
            body: data.body,
          },
        })
        return conversation
      })
    },
    async listGuardian(actorId: string, limit = 20, offset = 0) {
      pageSchema.parse({ limit, offset })
      const guardian = await resolveParentGuardian(database, actorId)
      const children = await eligibleParentChildren(database, actorId)
      if (children.length === 0) return []
      return database.familyConversation.findMany({
        where: {
          guardianId: guardian.id,
          OR: children.map((item) => ({
            studentId: item.studentId,
            schoolId: item.schoolId,
          })),
        },
        include: {
          student: {
            select: {
              studentReference: true,
              givenName: true,
              familyName: true,
            },
          },
          school: { select: { name: true } },
          messages: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      })
    },
    async listSchool(
      actorId: string,
      schoolId: string,
      limit = 20,
      offset = 0,
    ) {
      pageSchema.parse({ limit, offset })
      const role = await staffRole(actorId, schoolId)
      if (!role || role === 'approver')
        throw new FamilyConversationAccessError()
      const routeFilter =
        role === 'teacher'
          ? { route: 'teacher' as const, teacherUserId: actorId }
          : role === 'registrar'
            ? { route: 'schoolOffice' as const }
            : {
                OR: [
                  { route: 'schoolOffice' as const },
                  { route: 'teacher' as const, escalatedAt: { not: null } },
                ],
              }
      return database.familyConversation.findMany({
        where: { schoolId, ...routeFilter },
        include: {
          student: {
            select: {
              studentReference: true,
              givenName: true,
              familyName: true,
            },
          },
          messages: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      })
    },
    async read(
      actorId: string,
      conversationId: string,
      limit = 50,
      offset = 0,
    ) {
      pageSchema.parse({ limit, offset })
      const { conversation } = await requireConversation(
        actorId,
        conversationId,
      )
      const messages = await database.familyMessage.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
        skip: offset,
        select: { id: true, body: true, senderKind: true, createdAt: true },
      })
      return { conversation, messages }
    },
    async send(actorId: string, conversationId: string, body: string) {
      const text = FamilyMessageBodySchema.parse(body)
      const { conversation, guardian, staff } = await requireConversation(
        actorId,
        conversationId,
      )
      if (conversation.status !== 'open')
        throw new FamilyConversationStateError()
      if (!guardian && !staff) throw new FamilyConversationAccessError()
      if (
        conversation.route === 'teacher' &&
        (guardian || conversation.teacherUserId === actorId) &&
        !(await currentTeacher(conversation))
      )
        throw new FamilyConversationAccessError()
      return database.$transaction(async (transaction) => {
        const message = await transaction.familyMessage.create({
          data: {
            conversationId,
            senderUserId: actorId,
            senderKind: guardian ? 'guardian' : 'school',
            body: text,
          },
        })
        await transaction.familyConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        })
        if (guardian) {
          const recipients =
            conversation.route === 'teacher' && conversation.teacherUserId
              ? [conversation.teacherUserId]
              : (
                  await transaction.schoolMembership.findMany({
                    where: {
                      schoolId: conversation.schoolId,
                      role: { in: ['administrator', 'registrar'] },
                    },
                    select: { userId: true },
                  })
                ).map((member) => member.userId)
          await createNotifications(transaction, recipients, {
            type: 'familyMessage.reply',
            title: 'Family conversation reply',
            message: 'A family conversation has a new message.',
            resourceType: 'familyConversation',
            resourceId: conversationId,
          })
        } else {
          const recipient = await transaction.guardianAccess.findUnique({
            where: { guardianId: conversation.guardianId },
            select: { userId: true },
          })
          if (recipient)
            await createNotifications(transaction, [recipient.userId], {
              type: 'familyMessage.reply',
              title: 'Family conversation reply',
              message: 'Your family conversation has a new reply.',
              resourceType: 'familyConversation',
              resourceId: conversationId,
            })
        }
        return message
      })
    },
    async escalate(actorId: string, conversationId: string) {
      const { conversation, staff } = await requireConversation(
        actorId,
        conversationId,
      )
      if (!staff) throw new FamilyConversationAccessError()
      if (conversation.status !== 'open' || conversation.escalatedAt)
        throw new FamilyConversationStateError()
      if (
        conversation.route === 'teacher' &&
        conversation.teacherUserId === actorId &&
        !(await currentTeacher(conversation))
      )
        throw new FamilyConversationAccessError()
      return database.familyConversation.update({
        where: { id: conversationId },
        data: { escalatedAt: new Date(), escalatedById: actorId },
      })
    },
    async close(actorId: string, conversationId: string) {
      const { conversation, staff } = await requireConversation(
        actorId,
        conversationId,
      )
      if (!staff) throw new FamilyConversationAccessError()
      if (conversation.status !== 'open')
        throw new FamilyConversationStateError()
      return database.familyConversation.update({
        where: { id: conversationId },
        data: { status: 'closed', closedAt: new Date(), closedById: actorId },
      })
    },
  }
}

export type FamilyConversationService = ReturnType<
  typeof prismaFamilyConversationService
>
