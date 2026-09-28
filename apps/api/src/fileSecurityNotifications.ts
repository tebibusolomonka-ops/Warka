import type { PrismaClient } from '@warka/database'

type Store = Pick<PrismaClient, 'notification' | 'organizationMembership'>
type Event = 'processing' | 'quarantined' | 'failed' | 'rescanComplete'

const messages: Record<Event, { title: string; message: string }> = {
  processing: {
    title: 'File processing',
    message: 'Your uploaded file is awaiting a security scan.',
  },
  quarantined: {
    title: 'File rejected',
    message:
      'Your uploaded file did not pass its security scan. Contact operations for review.',
  },
  failed: {
    title: 'File scan needs attention',
    message: 'A file scan could not complete. The file remains unavailable.',
  },
  rescanComplete: {
    title: 'File scan completed',
    message: 'A file scan completed. Review its current availability status.',
  },
}

export async function notifyFileSecurity(
  database: Store,
  input: {
    event: Event
    fileAssetId: string
    ownerUserId?: string | null
    scanId: string
  },
  env: NodeJS.ProcessEnv = process.env,
) {
  const recipients = new Set<string>()
  if (input.ownerUserId && input.event !== 'failed')
    recipients.add(input.ownerUserId)
  if (input.event !== 'processing') {
    const allowed = (env.WARKA_OPERATOR_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    if (allowed.length) {
      const owners = await database.organizationMembership.findMany({
        where: {
          userId: { in: allowed },
          role: 'owner',
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
          user: { accountStatus: 'active' },
        },
        select: { userId: true },
      })
      for (const owner of owners) recipients.add(owner.userId)
    }
  }
  if (recipients.size === 0) return { count: 0 }
  const content = messages[input.event]
  return database.notification.createMany({
    data: [...recipients].map((userId) => ({
      userId,
      type: `fileSecurity.${input.event}`,
      title: content.title,
      message: content.message,
      resourceType: 'fileAsset',
      resourceId: input.fileAssetId,
      dedupeKey: `fileSecurity:${input.event}:${input.scanId}:${userId}`,
    })),
    skipDuplicates: true,
  })
}
