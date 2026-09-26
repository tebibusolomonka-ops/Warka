import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAcademicYearAdmin } from './academicYearClosing.js'
import { recordAuditEvent } from './auditEvents.js'

export const SchoolContactSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(120),
    role: z.enum(['primary', 'technical', 'records', 'emergency']),
    email: z.email().max(254).nullable().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9() .-]{7,30}$/)
      .nullable()
      .optional(),
  })
  .refine(
    (value) => !!value.email || !!value.phone,
    'Email or phone is required',
  )

export async function listSchoolContacts(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  return database.schoolContact.findMany({
    where: { schoolId },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
}

export async function createSchoolContact(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  input: unknown,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const data = SchoolContactSchema.parse(input)
  return database.$transaction(async (transaction) => {
    const contact = await transaction.schoolContact.create({
      data: {
        schoolId,
        name: data.name,
        role: data.role,
        email: data.email ?? null,
        phone: data.phone ?? null,
      },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolContact.created',
      resourceType: 'schoolContact',
      resourceId: contact.id,
    })
    return contact
  })
}

export async function updateSchoolContact(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  contactId: string,
  input: unknown,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const data = SchoolContactSchema.parse(input)
  return database.$transaction(async (transaction) => {
    const changed = await transaction.schoolContact.updateMany({
      where: { id: z.uuid().parse(contactId), schoolId },
      data: {
        name: data.name,
        role: data.role,
        email: data.email ?? null,
        phone: data.phone ?? null,
      },
    })
    if (!changed.count) return null
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolContact.updated',
      resourceType: 'schoolContact',
      resourceId: contactId,
    })
    return transaction.schoolContact.findUnique({ where: { id: contactId } })
  })
}

export async function deleteSchoolContact(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  contactId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const changed = await transaction.schoolContact.deleteMany({
      where: { id: z.uuid().parse(contactId), schoolId },
    })
    if (!changed.count) return false
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolContact.deleted',
      resourceType: 'schoolContact',
      resourceId: contactId,
    })
    return true
  })
}
