import type { PrismaClient } from '@warka/database'

export class OperationsPermissionError extends Error {
  constructor() {
    super('Operations access denied')
  }
}

export async function requireOperator(
  database: PrismaClient,
  actorId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const allowed = (env.WARKA_OPERATOR_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (!allowed.includes(actorId)) throw new OperationsPermissionError()
  const membership = await database.organizationMembership.findFirst({
    where: {
      userId: actorId,
      role: 'owner',
      startsAt: { lte: new Date() },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      user: { accountStatus: 'active' },
    },
    select: { userId: true },
  })
  if (!membership) throw new OperationsPermissionError()
}
