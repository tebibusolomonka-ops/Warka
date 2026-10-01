import type { PrismaClient, MaintenanceWindowStatus } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'

export const MaintenanceWindowInputSchema = z
  .strictObject({
    title: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .refine((value) => !/[<>\r\n]/.test(value)),
    reason: z
      .string()
      .trim()
      .min(3)
      .max(500)
      .refine((value) => !/[<>\r\n]/.test(value)),
    scope: z.enum([
      'platform',
      'database',
      'storage',
      'email',
      'scanner',
      'scheduler',
    ]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    message: 'Maintenance start must precede end',
  })

export async function createMaintenanceWindow(
  database: PrismaClient,
  actorId: string,
  input: unknown,
) {
  const data = MaintenanceWindowInputSchema.parse(input)
  return database.$transaction(async (tx) => {
    const window = await tx.maintenanceWindow.create({
      data: { ...data, createdById: actorId },
    })
    await recordAuditEvent(tx, {
      actorUserId: actorId,
      action: 'maintenanceWindow.created',
      resourceType: 'maintenanceWindow',
      resourceId: window.id,
    })
    return window
  })
}

export function maintenanceEffect(
  scope: string,
  alert: {
    signal: string
    category: 'availability' | 'security' | 'integrity'
  },
) {
  const affected = scope === 'platform' || alert.signal.startsWith(`${scope}_`)
  return {
    affected,
    suppressNotification: affected && alert.category === 'availability',
    underlyingHealthy: false,
  }
}

export async function changeMaintenanceWindowStatus(
  database: PrismaClient,
  id: string,
  actorId: string,
  status: MaintenanceWindowStatus,
) {
  return database.$transaction(async (tx) => {
    const current = await tx.maintenanceWindow.findUnique({ where: { id } })
    if (
      !current ||
      !(
        {
          scheduled: ['inProgress', 'completed', 'cancelled'],
          inProgress: ['completed', 'cancelled'],
          completed: [],
          cancelled: [],
        } as Record<MaintenanceWindowStatus, MaintenanceWindowStatus[]>
      )[current.status].includes(status)
    ) {
      throw new Error('Invalid maintenance status transition')
    }
    const updated = await tx.maintenanceWindow.update({
      where: { id },
      data: { status },
    })
    await recordAuditEvent(tx, {
      actorUserId: actorId,
      action: 'maintenanceWindow.changed',
      resourceType: 'maintenanceWindow',
      resourceId: id,
      metadata: { status },
    })
    return updated
  })
}
