import type {
  OperationalIncidentSeverity,
  PrismaClient,
  OperationalIncidentStatus,
} from '@prisma/client'
import { z } from 'zod'
import { OperationalIncidentInputSchema } from './operationalIncidentInput.js'
import { recordAuditEvent } from './auditEvents.js'

const messageSchema = z
  .string()
  .trim()
  .min(3)
  .max(500)
  .refine(
    (value) => !/[<>\r\n]/.test(value) && !/[\w.+-]+@[\w.-]+/.test(value),
    'Use plain operational text',
  )

const timelineEventSchema = z.enum([
  'declared',
  'severityChanged',
  'alertLinked',
  'maintenanceStarted',
  'mitigationRecorded',
  'serviceRecovered',
  'resolved',
  'correction',
])

const transitions: Record<
  OperationalIncidentStatus,
  OperationalIncidentStatus[]
> = {
  open: ['investigating', 'monitoring', 'resolved'],
  investigating: ['monitoring', 'resolved'],
  monitoring: ['investigating', 'resolved'],
  resolved: [],
}

export async function createOperationalIncident(
  database: PrismaClient,
  actorId: string,
  input: unknown,
) {
  const data = OperationalIncidentInputSchema.parse(input)
  return database.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.create({
      data: { ...data, createdById: actorId },
    })
    await tx.operationalIncidentUpdate.create({
      data: {
        incidentId: incident.id,
        status: 'open',
        eventType: 'declared',
        message: data.summary,
        createdById: actorId,
      },
    })
    await recordAuditEvent(tx, {
      actorUserId: actorId,
      action: 'operationalIncident.created',
      resourceType: 'operationalIncident',
      resourceId: incident.id,
      metadata: { severity: data.severity },
    })
    return incident
  })
}

export async function appendIncidentTimelineEvent(
  database: PrismaClient,
  incidentId: string,
  actorId: string,
  eventType: string,
  note: string,
) {
  const type = timelineEventSchema.parse(eventType)
  const message = messageSchema.parse(note)
  return database.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.findUnique({
      where: { id: incidentId },
    })
    if (!incident) throw new Error('Incident not found')
    const event = await tx.operationalIncidentUpdate.create({
      data: {
        incidentId,
        status: incident.status,
        eventType: type,
        message,
        createdById: actorId,
      },
    })
    await recordAuditEvent(tx, {
      actorUserId: actorId,
      action: 'operationalIncident.timelineAppended',
      resourceType: 'operationalIncident',
      resourceId: incidentId,
      metadata: { eventType: type },
    })
    return event
  })
}

export async function postOperationalIncidentUpdate(
  database: PrismaClient,
  incidentId: string,
  actorId: string,
  message: string,
) {
  const text = messageSchema.parse(message)
  return database.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.findUnique({
      where: { id: incidentId },
    })
    if (!incident || incident.status === 'resolved')
      throw new Error('Incident is not open')
    return tx.operationalIncidentUpdate.create({
      data: {
        incidentId,
        status: incident.status,
        message: text,
        createdById: actorId,
      },
    })
  })
}

export async function changeOperationalIncidentStatus(
  database: PrismaClient,
  incidentId: string,
  actorId: string,
  status: OperationalIncidentStatus,
  message: string,
) {
  const text = messageSchema.parse(message)
  return database.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.findUnique({
      where: { id: incidentId },
    })
    if (!incident || !transitions[incident.status].includes(status))
      throw new Error('Invalid incident status transition')
    const updated = await tx.operationalIncident.update({
      where: { id: incidentId },
      data: {
        status,
        ...(status === 'resolved'
          ? { resolvedAt: new Date(), resolvedById: actorId }
          : {}),
      },
    })
    await tx.operationalIncidentUpdate.create({
      data: { incidentId, status, message: text, createdById: actorId },
    })
    await recordAuditEvent(tx, {
      actorUserId: actorId,
      action:
        status === 'resolved'
          ? 'operationalIncident.resolved'
          : 'operationalIncident.updated',
      resourceType: 'operationalIncident',
      resourceId: incidentId,
      metadata: { status },
    })
    return updated
  })
}

export function resolveOperationalIncident(
  database: PrismaClient,
  incidentId: string,
  actorId: string,
  message: string,
) {
  return changeOperationalIncidentStatus(
    database,
    incidentId,
    actorId,
    'resolved',
    message,
  )
}

export const incidentSeverityMeaning: Record<
  OperationalIncidentSeverity,
  string
> = {
  critical:
    'Platform unavailable or confirmed severe security or data-integrity impact',
  high: 'Major capability unavailable with broad operational impact',
  medium: 'Degraded capability with a viable operational workaround',
  low: 'Limited operational impact requiring tracked follow-up',
}

export async function changeOperationalIncidentSeverity(
  database: PrismaClient,
  incidentId: string,
  actorId: string,
  severity: OperationalIncidentSeverity,
  message: string,
) {
  const text = messageSchema.parse(message)
  return database.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.findUnique({
      where: { id: incidentId },
    })
    if (!incident || incident.status === 'resolved')
      throw new Error('Incident is not open')
    const updated = await tx.operationalIncident.update({
      where: { id: incidentId },
      data: { severity },
    })
    await tx.operationalIncidentUpdate.create({
      data: {
        incidentId,
        status: incident.status,
        message: text,
        createdById: actorId,
      },
    })
    await recordAuditEvent(tx, {
      actorUserId: actorId,
      action: 'operationalIncident.severityChanged',
      resourceType: 'operationalIncident',
      resourceId: incidentId,
      metadata: { severity },
    })
    return updated
  })
}
