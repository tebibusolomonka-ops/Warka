import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'

export const CreateSupportRequestSchema = z.strictObject({
  category: z.enum([
    'account',
    'studentRecords',
    'academicResults',
    'documents',
    'reporting',
    'technical',
  ]),
  severity: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(10).max(4000),
})
export class SupportRequestPermissionError extends Error {
  constructor() {
    super('Support request access denied')
  }
}
export class SupportRequestStateError extends Error {
  constructor() {
    super('Support request cannot make this transition')
  }
}

export async function requireSchoolSupportUser(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const membership = await database.schoolMembership.findUnique({
    where: {
      userId_schoolId: {
        userId: z.uuid().parse(actorId),
        schoolId: z.uuid().parse(schoolId),
      },
    },
  })
  if (!membership) throw new SupportRequestPermissionError()
  return membership
}

export async function createSupportRequest(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  input: unknown,
) {
  await requireSchoolSupportUser(database, actorId, schoolId)
  const data = CreateSupportRequestSchema.parse(input)
  return database.$transaction(async (transaction) => {
    const request = await transaction.supportRequest.create({
      data: { ...data, schoolId, createdById: actorId },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'supportRequest.created',
      resourceType: 'supportRequest',
      resourceId: request.id,
      metadata: { category: data.category, severity: data.severity },
    })
    return request
  })
}

export async function listSchoolSupportRequests(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireSchoolSupportUser(database, actorId, schoolId)
  return database.supportRequest.findMany({
    where: { schoolId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
  })
}
