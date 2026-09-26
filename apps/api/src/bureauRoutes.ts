import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  approveSchoolReport,
  assignRequiredSchools,
  buildAcademicAggregate,
  buildEnrollmentAggregate,
  buildRegionalActivityAggregate,
  closeReportingPeriod,
  createReportingPeriod,
  getReportingCoverage,
  listReportingPeriods,
  openReportingPeriod,
  prepareSchoolReport,
  removeRequiredSchool,
  requireBureauPermission,
  resolveBureauScope,
  returnSchoolReport,
  submitSchoolReport,
  ReportingSubmissionError,
  findSchoolMembership,
  hasOrganizationAdminRole,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const IdSchema = z.strictObject({ organizationId: z.uuid(), id: z.uuid() })
const ScopeSchema = z.strictObject({ organizationId: z.uuid() })
const PeriodSchema = z.strictObject({
  organizationId: z.uuid(),
  periodId: z.uuid(),
})
const SchoolPeriodSchema = z.strictObject({
  schoolId: z.uuid(),
  periodId: z.uuid(),
})

export function registerBureauRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get('/bureau/access', { preHandler: authenticate }, (request) =>
    resolveBureauScope(getDatabase(), authenticatedUser(request).id),
  )
  app.get(
    '/bureau/:organizationId/periods',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = ScopeSchema.parse(request.params)
      return listReportingPeriods(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
      )
    },
  )
  app.post(
    '/bureau/:organizationId/periods',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = ScopeSchema.parse(request.params)
      return createReportingPeriod(
        getDatabase(),
        authenticatedUser(request).id,
        {
          ...z
            .strictObject({
              name: z.string(),
              startsOn: z.string(),
              endsOn: z.string(),
              submissionDueOn: z.string(),
            })
            .parse(request.body),
          organizationId,
        },
      )
    },
  )
  for (const action of ['open', 'close'] as const)
    app.post(
      '/bureau/:organizationId/periods/:periodId/' + action,
      { preHandler: authenticate },
      (request) => {
        const { periodId } = PeriodSchema.parse(request.params)
        return action === 'open'
          ? openReportingPeriod(
              getDatabase(),
              authenticatedUser(request).id,
              periodId,
            )
          : closeReportingPeriod(
              getDatabase(),
              authenticatedUser(request).id,
              periodId,
            )
      },
    )
  app.put(
    '/bureau/:organizationId/periods/:periodId/schools',
    { preHandler: authenticate },
    (request) => {
      const { periodId } = PeriodSchema.parse(request.params)
      const { schoolIds } = z
        .strictObject({ schoolIds: z.array(z.uuid()).max(500) })
        .parse(request.body)
      return assignRequiredSchools(
        getDatabase(),
        authenticatedUser(request).id,
        periodId,
        schoolIds,
      )
    },
  )
  app.get(
    '/bureau/:organizationId/periods/:periodId/coverage',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId, periodId } = PeriodSchema.parse(request.params)
      await requireBureauPermission(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
        'view',
      )
      return getReportingCoverage(getDatabase(), periodId)
    },
  )
  app.get(
    '/bureau/:organizationId/submissions',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId } = ScopeSchema.parse(request.params)
      await requireBureauPermission(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
        'view',
      )
      return getDatabase().reportingSubmission.findMany({
        where: { reportingPeriod: { organizationId } },
        include: { school: true, reportingPeriod: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })
    },
  )
  app.post(
    '/bureau/:organizationId/submissions/:id/approve',
    { preHandler: authenticate },
    (request) => {
      const { id } = IdSchema.parse(request.params)
      return approveSchoolReport(
        getDatabase(),
        authenticatedUser(request).id,
        id,
      )
    },
  )
  app.post(
    '/bureau/:organizationId/submissions/:id/return',
    { preHandler: authenticate },
    (request) => {
      const { id } = IdSchema.parse(request.params)
      const { reason } = z
        .strictObject({ reason: z.string() })
        .parse(request.body)
      return returnSchoolReport(
        getDatabase(),
        authenticatedUser(request).id,
        id,
        reason,
      )
    },
  )
  app.delete(
    '/bureau/:organizationId/periods/:periodId/schools/:schoolId',
    { preHandler: authenticate },
    (request) => {
      const { periodId, schoolId } = z
        .strictObject({
          organizationId: z.uuid(),
          periodId: z.uuid(),
          schoolId: z.uuid(),
        })
        .parse(request.params)
      return removeRequiredSchool(
        getDatabase(),
        authenticatedUser(request).id,
        periodId,
        schoolId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/reporting',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = z
        .strictObject({ schoolId: z.uuid() })
        .parse(request.params)
      const userId = authenticatedUser(request).id
      const school = await getDatabase().school.findUniqueOrThrow({
        where: { id: schoolId },
      })
      const membership = await findSchoolMembership(
        getDatabase(),
        userId,
        schoolId,
      )
      const organizationAdmin = await hasOrganizationAdminRole(
        getDatabase(),
        userId,
        school.organizationId,
      )
      if (
        !organizationAdmin &&
        (!membership ||
          !['administrator', 'registrar'].includes(membership.role))
      )
        throw new ReportingSubmissionError('School reporting permission denied')
      const requirements = await getDatabase().reportingRequirement.findMany({
        where: { schoolId },
        include: { reportingPeriod: true, school: true },
        orderBy: { reportingPeriod: { startsOn: 'desc' } },
      })
      return Promise.all(
        requirements.map(async (requirement) => ({
          ...requirement,
          submission: await getDatabase().reportingSubmission.findUnique({
            where: {
              reportingPeriodId_schoolId: {
                reportingPeriodId: requirement.reportingPeriodId,
                schoolId,
              },
            },
          }),
        })),
      )
    },
  )
  app.post(
    '/schools/:schoolId/reporting/:periodId/prepare',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, periodId } = SchoolPeriodSchema.parse(request.params)
      const period = await getDatabase().reportingPeriod.findUniqueOrThrow({
        where: { id: periodId },
      })
      const [enrollment, academic, activity] = await Promise.all([
        buildEnrollmentAggregate(
          getDatabase(),
          schoolId,
          period.startsOn,
          period.endsOn,
        ),
        buildAcademicAggregate(
          getDatabase(),
          schoolId,
          period.startsOn,
          period.endsOn,
        ),
        buildRegionalActivityAggregate(
          getDatabase(),
          schoolId,
          period.startsOn,
          period.endsOn,
        ),
      ])
      return prepareSchoolReport(
        getDatabase(),
        authenticatedUser(request).id,
        periodId,
        schoolId,
        { enrollment, academic, activity },
      )
    },
  )
  app.post(
    '/schools/:schoolId/reporting/:periodId/submit',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, periodId } = SchoolPeriodSchema.parse(request.params)
      return submitSchoolReport(
        getDatabase(),
        authenticatedUser(request).id,
        periodId,
        schoolId,
      )
    },
  )
}
