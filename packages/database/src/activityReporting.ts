import type { PrismaClient, VerificationResultStatus } from '@prisma/client'

export type RegionalActivityAggregate = {
  transfers: { confirmed: number; unresolved: number; rejected: number }
  verification: Record<VerificationResultStatus, number>
}

export function emptyRegionalActivity(): RegionalActivityAggregate {
  return {
    transfers: { confirmed: 0, unresolved: 0, rejected: 0 },
    verification: { active: 0, corrected: 0, withdrawn: 0, unavailable: 0 },
  }
}

export async function buildRegionalActivityAggregate(
  database: Pick<PrismaClient, 'transferRequest' | 'verificationEvent'>,
  schoolId: string,
  startsOn: Date,
  endsOn: Date,
): Promise<RegionalActivityAggregate> {
  const [transfers, events] = await Promise.all([
    database.transferRequest.groupBy({
      by: ['status'],
      where: {
        OR: [{ sendingSchoolId: schoolId }, { receivingSchoolId: schoolId }],
        createdAt: { gte: startsOn, lte: endsOn },
      },
      _count: { _all: true },
    }),
    database.verificationEvent.groupBy({
      by: ['resultStatus'],
      where: { schoolId, occurredAt: { gte: startsOn, lte: endsOn } },
      _count: { _all: true },
    }),
  ])
  const aggregate = emptyRegionalActivity()
  for (const row of transfers) {
    if (row.status === 'acceptedByReceivingSchool')
      aggregate.transfers.confirmed += row._count._all
    else if (row.status === 'rejected')
      aggregate.transfers.rejected += row._count._all
    else if (['requested', 'approvedBySendingSchool'].includes(row.status))
      aggregate.transfers.unresolved += row._count._all
  }
  for (const event of events)
    aggregate.verification[event.resultStatus] = event._count._all
  return aggregate
}
