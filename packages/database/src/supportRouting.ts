import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { checkSupportAccess } from './supportAccess.js'
import {
  SupportRequestPermissionError,
  SupportRequestStateError,
} from './supportRequests.js'
import { recordAuditEvent } from './auditEvents.js'
import { createNotification } from './notifications.js'

async function role(database: PrismaClient, actorId: string, schoolId: string) {
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId } },
  })
  if (membership) return 'school' as const
  const identity = await database.supportIdentity.findUnique({
    where: { userId: actorId },
  })
  if (!identity) throw new SupportRequestPermissionError()
  try {
    await checkSupportAccess(database, actorId, schoolId)
  } catch {
    throw new SupportRequestPermissionError()
  }
  return 'support' as const
}

export async function listRoutedSupportRequests(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await role(database, actorId, schoolId)
  return database.supportRequest.findMany({
    where: { schoolId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
  })
}

export async function getRoutedSupportRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
) {
  await role(database, actorId, schoolId)
  const request = await database.supportRequest.findFirst({
    where: { id: z.uuid().parse(requestId), schoolId },
    include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  })
  if (!request) throw new SupportRequestPermissionError()
  return request
}

export async function replyToSupportRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
  body: string,
) {
  const actorRole = await role(database, actorId, schoolId)
  const text = z.string().trim().min(2).max(4000).parse(body)
  const request = await database.supportRequest.findFirst({
    where: { id: z.uuid().parse(requestId), schoolId },
  })
  if (!request) throw new SupportRequestPermissionError()
  if (request.status === 'closed' || request.status === 'resolved')
    throw new SupportRequestStateError()
  return database.$transaction(async (transaction) => {
    const message = await transaction.supportRequestMessage.create({
      data: { requestId, senderId: actorId, body: text },
    })
    await transaction.supportRequest.update({
      where: { id: requestId },
      data:
        actorRole === 'support'
          ? { status: 'waitingForSchool', assignedSupportUserId: actorId }
          : { status: 'open' },
    })
    const recipient =
      actorRole === 'support'
        ? request.createdById
        : request.assignedSupportUserId
    if (recipient && recipient !== actorId)
      await createNotification(transaction, {
        userId: recipient,
        type: 'support.response',
        title: 'Support request updated',
        message: 'A response was added to your support request.',
        resourceType: 'supportRequest',
        resourceId: requestId,
      })
    if (actorRole === 'support')
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'supportRequest.responded',
        resourceType: 'supportRequest',
        resourceId: requestId,
      })
    return message
  })
}

export async function resolveSupportRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
  summary: string,
) {
  if ((await role(database, actorId, schoolId)) !== 'support')
    throw new SupportRequestPermissionError()
  const resolutionSummary = z.string().trim().min(10).max(1000).parse(summary)
  const request = await database.supportRequest.findFirst({
    where: { id: z.uuid().parse(requestId), schoolId },
  })
  if (!request) throw new SupportRequestPermissionError()
  if (request.status === 'closed' || request.status === 'resolved')
    throw new SupportRequestStateError()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.supportRequest.updateMany({
      where: {
        id: requestId,
        schoolId,
        status: { in: ['open', 'inProgress', 'waitingForSchool'] },
      },
      data: {
        status: 'resolved',
        resolutionSummary,
        assignedSupportUserId: actorId,
      },
    })
    if (changed.count !== 1) throw new SupportRequestStateError()
    await createNotification(transaction, {
      userId: request.createdById,
      type: 'support.resolved',
      title: 'Support request resolved',
      message: 'A resolution is available for your support request.',
      resourceType: 'supportRequest',
      resourceId: requestId,
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'supportRequest.resolved',
      resourceType: 'supportRequest',
      resourceId: requestId,
    })
    return transaction.supportRequest.findUniqueOrThrow({
      where: { id: requestId },
    })
  })
}

export async function closeSupportRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  requestId: string,
) {
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId } },
  })
  if (!membership) throw new SupportRequestPermissionError()
  const request = await database.supportRequest.findFirst({
    where: { id: z.uuid().parse(requestId), schoolId },
  })
  if (
    !request ||
    (request.createdById !== actorId && membership.role !== 'administrator')
  )
    throw new SupportRequestPermissionError()
  if (request.status !== 'resolved') throw new SupportRequestStateError()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.supportRequest.updateMany({
      where: { id: requestId, schoolId, status: 'resolved' },
      data: { status: 'closed', closedAt: new Date() },
    })
    if (changed.count !== 1) throw new SupportRequestStateError()
    if (request.assignedSupportUserId)
      await createNotification(transaction, {
        userId: request.assignedSupportUserId,
        type: 'support.closed',
        title: 'Support request closed',
        message: 'The school closed a resolved support request.',
        resourceType: 'supportRequest',
        resourceId: requestId,
      })
    return transaction.supportRequest.findUniqueOrThrow({
      where: { id: requestId },
    })
  })
}
