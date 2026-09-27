export type EffectivePeriod = {
  startsAt: Date
  endsAt: Date | null
}

export function isMembershipEffective(
  membership: EffectivePeriod | null | undefined,
  now = new Date(),
): boolean {
  return (
    !!membership &&
    membership.startsAt <= now &&
    (membership.endsAt === null || membership.endsAt > now)
  )
}

export function effectiveMembershipWhere(now = new Date()) {
  return {
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  }
}
