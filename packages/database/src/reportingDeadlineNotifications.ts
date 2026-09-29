import type { PrismaClient } from '@prisma/client'
import { effectiveMembershipWhere } from './membershipPeriods.js'

type ReminderPeriod = {
  id: string
  opensAt: Date | null
  dueAt: Date | null
  submissionDueOn: Date
  updatedAt: Date
  requirements: { schoolId: string }[]
  submissions: { schoolId: string; status: string }[]
}
type ReminderRecipient = { schoolId: string; userId: string }

export function planReportingDeadlineNotifications(
  periods: ReminderPeriod[],
  recipients: ReminderRecipient[],
  now = new Date(),
) {
  const day = 24 * 60 * 60_000
  const data: {
    userId: string
    type: string
    title: string
    message: string
    resourceType: string
    resourceId: string
    dedupeKey: string
  }[] = []
  for (const period of periods) {
    const due = period.dueAt ?? period.submissionDueOn
    const opened = period.opensAt ?? period.updatedAt
    for (const requirement of period.requirements) {
      const status = period.submissions.find(
        (item) => item.schoolId === requirement.schoolId,
      )?.status
      if (
        status === 'submitted' ||
        status === 'underReview' ||
        status === 'approved'
      )
        continue
      let kind: 'opened' | 'dueSoon' | 'due' | null = null
      if (due <= now && now.getTime() - due.getTime() <= day) kind = 'due'
      else if (due > now && due.getTime() - now.getTime() <= 3 * day)
        kind = 'dueSoon'
      else if (opened <= now && now.getTime() - opened.getTime() <= day)
        kind = 'opened'
      if (!kind) continue
      const copy = {
        opened: [
          'Reporting window opened',
          'A school report is ready to prepare.',
        ],
        dueSoon: [
          'Reporting due date approaching',
          'A school report is due soon.',
        ],
        due: [
          'Report due',
          'A school report submission has not been received.',
        ],
      }[kind]
      for (const recipient of recipients) {
        if (recipient.schoolId !== requirement.schoolId) continue
        data.push({
          userId: recipient.userId,
          type: `report.${kind}`,
          title: copy[0]!,
          message: copy[1]!,
          resourceType: 'reportingPeriod',
          resourceId: period.id,
          dedupeKey: `report:${kind}:${period.id}:${requirement.schoolId}:${recipient.userId}`,
        })
      }
    }
  }
  return data
}

export async function scheduleReportingDeadlineNotifications(
  database: PrismaClient,
  now = new Date(),
) {
  const periods = await database.reportingPeriod.findMany({
    where: { status: 'open' },
    select: {
      id: true,
      opensAt: true,
      dueAt: true,
      submissionDueOn: true,
      updatedAt: true,
      requirements: { select: { schoolId: true } },
      submissions: { select: { schoolId: true, status: true } },
    },
    take: 100,
  })
  const schoolIds = [
    ...new Set(
      periods.flatMap((item) =>
        item.requirements.map((school) => school.schoolId),
      ),
    ),
  ]
  if (schoolIds.length === 0) return { count: 0 }
  const recipients = await database.schoolMembership.findMany({
    where: {
      schoolId: { in: schoolIds },
      role: { in: ['administrator', 'registrar'] },
      ...effectiveMembershipWhere(now),
    },
    select: { schoolId: true, userId: true },
  })
  const data = planReportingDeadlineNotifications(periods, recipients, now)
  if (data.length === 0) return { count: 0 }
  return database.notification.createMany({ data, skipDuplicates: true })
}
