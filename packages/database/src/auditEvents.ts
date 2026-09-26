import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const AuditActionSchema = z.enum([
  'account.provisioned',
  'studentAccount.provisioned',
  'guardianAccount.provisioned',
  'membership.changed',
  'schoolStaff.assigned',
  'guardianRelationship.verified',
  'guardianRelationship.revoked',
  'result.published',
  'result.corrected',
  'document.issued',
  'document.corrected',
  'document.withdrawn',
  'transfer.approved',
  'transfer.accepted',
  'transfer.rejected',
  'report.submitted',
  'report.approved',
  'report.returned',
  'report.exported',
  'parentPortal.updated',
  'bureauAccess.granted',
  'bureauAccess.revoked',
  'accessReview.started',
  'accessReview.completed',
  'supportAccess.requested',
  'supportAccess.approved',
  'supportAccess.revoked',
  'retentionPolicy.created',
  'retentionPolicy.updated',
])

export const AuditResourceTypeSchema = z.enum([
  'user',
  'student',
  'guardian',
  'membership',
  'resultSet',
  'publishedResult',
  'issuedDocument',
  'transferRequest',
  'reportingSubmission',
  'schoolServiceAccess',
  'bureauAccess',
  'accessReview',
  'supportAccessGrant',
  'retentionPolicy',
])

const metadataValue = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.null(),
])
const forbiddenMetadataKey =
  /password|credential|token|cookie|private.?key|secret/i
export const AuditMetadataSchema = z
  .record(z.string().min(1).max(60), metadataValue)
  .superRefine((value, context) => {
    const keys = Object.keys(value)
    if (keys.length > 12)
      context.addIssue({
        code: 'custom',
        message: 'Audit metadata has too many fields',
      })
    for (const key of keys)
      if (forbiddenMetadataKey.test(key))
        context.addIssue({
          code: 'custom',
          message: 'Sensitive audit metadata is forbidden',
        })
  })

export const RecordAuditEventSchema = z.strictObject({
  organizationId: z.uuid().optional(),
  schoolId: z.uuid().optional(),
  actorUserId: z.uuid().optional(),
  action: AuditActionSchema,
  resourceType: AuditResourceTypeSchema,
  resourceId: z.string().min(1).max(120).optional(),
  metadata: AuditMetadataSchema.default({}),
  occurredAt: z.date().optional(),
})

type AuditStore = Pick<PrismaClient, 'auditEvent'>

export function recordAuditEvent(database: AuditStore, input: unknown) {
  const event = RecordAuditEventSchema.parse(input)
  return database.auditEvent.create({
    data: {
      action: event.action,
      resourceType: event.resourceType,
      metadata: event.metadata,
      ...(event.organizationId ? { organizationId: event.organizationId } : {}),
      ...(event.schoolId ? { schoolId: event.schoolId } : {}),
      ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
      ...(event.resourceId ? { resourceId: event.resourceId } : {}),
      ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
    },
  })
}

export function listAuditEvents(
  database: AuditStore,
  input: {
    organizationId?: string
    schoolId?: string
    action?: z.infer<typeof AuditActionSchema>
    resourceType?: z.infer<typeof AuditResourceTypeSchema>
    from?: Date
    to?: Date
    take?: number
    cursor?: string
  },
) {
  if (!input.organizationId && !input.schoolId)
    throw new Error('Audit query requires an organization or school scope')
  const take = Math.min(Math.max(input.take ?? 50, 1), 100)
  return database.auditEvent.findMany({
    where: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.resourceType ? { resourceType: input.resourceType } : {}),
      ...((input.from || input.to) && {
        occurredAt: {
          ...(input.from ? { gte: input.from } : {}),
          ...(input.to ? { lte: input.to } : {}),
        },
      }),
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  })
}
