import type { PrismaClient } from '@warka/database'

type AlertEvent =
  | 'backupFailed'
  | 'verificationFailed'
  | 'rehearsalFailed'
  | 'criticalIncident'
  | 'incidentResolved'
  | 'emailDeliveryFailed'

const messages: Record<AlertEvent, { title: string; message: string }> = {
  backupFailed: {
    title: 'Backup failed',
    message: 'A database backup needs operator review.',
  },
  verificationFailed: {
    title: 'Backup verification failed',
    message: 'A backup artifact failed integrity verification.',
  },
  rehearsalFailed: {
    title: 'Restore rehearsal failed',
    message: 'An isolated restore rehearsal needs operator review.',
  },
  criticalIncident: {
    title: 'Critical service incident',
    message: 'A critical operational incident was opened.',
  },
  incidentResolved: {
    title: 'Service incident resolved',
    message: 'An operational incident was resolved.',
  },
  emailDeliveryFailed: {
    title: 'Email delivery needs review',
    message: 'A transactional email delivery could not be completed.',
  },
}

export async function sendOperationsAlert(
  database: PrismaClient,
  event: AlertEvent,
  resourceId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const allowed = (env.WARKA_OPERATOR_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (allowed.length === 0) return { count: 0 }
  const memberships = await database.organizationMembership.findMany({
    where: {
      userId: { in: allowed },
      role: 'owner',
      startsAt: { lte: new Date() },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      user: { accountStatus: 'active' },
    },
    select: { userId: true },
  })
  const recipients = [...new Set(memberships.map((item) => item.userId))]
  if (recipients.length === 0) return { count: 0 }
  const content = messages[event]
  return database.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: `operations.${event}`,
      title: content.title,
      message: content.message,
      resourceType: 'operationalEvent',
      resourceId,
      dedupeKey: `${event}:${resourceId}:${userId}`,
    })),
    skipDuplicates: true,
  })
}
