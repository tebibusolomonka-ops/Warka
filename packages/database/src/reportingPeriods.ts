import type { PrismaClient, ReportingPeriodStatus } from '@prisma/client'
import { z } from 'zod'
import { requireBureauPermission } from './bureauAccess.js'

export class ReportingRequirementStateError extends Error {}

export const CreateReportingPeriodSchema = z
  .object({
    organizationId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    startsOn: z.coerce.date(),
    endsOn: z.coerce.date(),
    submissionDueOn: z.coerce.date(),
    opensAt: z.coerce.date().optional(),
    dueAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
  })
  .refine((value) => value.startsOn < value.endsOn, {
    message: 'Reporting period must end after it starts',
  })
  .refine((value) => value.submissionDueOn >= value.endsOn, {
    message: 'Submission due date cannot precede the period end',
  })
  .refine(
    (value) => !value.opensAt || !value.dueAt || value.opensAt < value.dueAt,
    { message: 'Submission window must open before due time' },
  )
  .refine(
    (value) => !value.closesAt || !value.dueAt || value.dueAt < value.closesAt,
    { message: 'Submission window must close after due time' },
  )
  .refine(
    (value) =>
      !value.closesAt || !value.opensAt || value.opensAt < value.closesAt,
    { message: 'Submission window order is invalid' },
  )
  .refine((value) => Boolean(value.opensAt) === Boolean(value.dueAt), {
    message: 'Submission window open and due times must be provided together',
  })

export function reportingWindowState(
  period: {
    opensAt: Date | null
    dueAt: Date | null
    closesAt: Date | null
    submissionDueOn: Date
  },
  now = new Date(),
) {
  if (period.opensAt && now < period.opensAt) return 'notOpen' as const
  if (period.closesAt && now >= period.closesAt) return 'closed' as const
  return now > (period.dueAt ?? period.submissionDueOn)
    ? ('pastDue' as const)
    : ('open' as const)
}

type ReportingPeriodStore = Pick<
  PrismaClient,
  | 'bureauAccess'
  | 'reportingPeriod'
  | 'reportingRequirement'
  | 'reportingSubmission'
  | 'school'
>

export async function createReportingPeriod(
  database: ReportingPeriodStore,
  actorUserId: string,
  input: unknown,
) {
  const value = CreateReportingPeriodSchema.parse(input)
  await requireBureauPermission(
    database,
    actorUserId,
    value.organizationId,
    'manage',
  )
  return database.reportingPeriod.create({
    data: {
      organizationId: value.organizationId,
      name: value.name,
      startsOn: value.startsOn,
      endsOn: value.endsOn,
      submissionDueOn: value.submissionDueOn,
      ...(value.opensAt ? { opensAt: value.opensAt } : {}),
      ...(value.dueAt ? { dueAt: value.dueAt } : {}),
      ...(value.closesAt ? { closesAt: value.closesAt } : {}),
    },
  })
}

async function changeReportingPeriodStatus(
  database: ReportingPeriodStore,
  actorUserId: string,
  reportingPeriodId: string,
  from: ReportingPeriodStatus,
  status: ReportingPeriodStatus,
) {
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  await requireBureauPermission(
    database,
    actorUserId,
    period.organizationId,
    'manage',
  )
  return database.reportingPeriod.update({
    where: { id: reportingPeriodId, status: from },
    data: { status },
  })
}

export function openReportingPeriod(
  database: ReportingPeriodStore,
  actorUserId: string,
  reportingPeriodId: string,
) {
  return changeReportingPeriodStatus(
    database,
    actorUserId,
    reportingPeriodId,
    'draft',
    'open',
  )
}

export function closeReportingPeriod(
  database: ReportingPeriodStore,
  actorUserId: string,
  reportingPeriodId: string,
) {
  return changeReportingPeriodStatus(
    database,
    actorUserId,
    reportingPeriodId,
    'open',
    'closed',
  )
}

export async function assignRequiredSchools(
  database: ReportingPeriodStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolIds: string[],
) {
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  await requireBureauPermission(
    database,
    actorUserId,
    period.organizationId,
    'manage',
  )
  const schools = await database.school.count({
    where: { id: { in: schoolIds }, organizationId: period.organizationId },
  })
  if (schools !== new Set(schoolIds).size)
    throw new Error('Every required school must belong to the reporting scope')
  await database.reportingRequirement.createMany({
    data: [...new Set(schoolIds)].map((schoolId) => ({
      reportingPeriodId,
      schoolId,
    })),
    skipDuplicates: true,
  })
  return database.reportingRequirement.findMany({
    where: { reportingPeriodId },
    include: { school: true },
  })
}

export async function removeRequiredSchool(
  database: ReportingPeriodStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
) {
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  await requireBureauPermission(
    database,
    actorUserId,
    period.organizationId,
    'manage',
  )
  const submission = await database.reportingSubmission.findUnique({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
  })
  if (submission)
    throw new ReportingRequirementStateError(
      'A reporting requirement with report history cannot be removed',
    )
  return database.reportingRequirement.delete({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
  })
}
export async function listReportingPeriods(
  database: ReportingPeriodStore,
  userId: string,
  organizationId: string,
) {
  await requireBureauPermission(database, userId, organizationId, 'view')
  return database.reportingPeriod.findMany({
    where: { organizationId },
    include: { requirements: { include: { school: true } } },
    orderBy: { startsOn: 'desc' },
  })
}
