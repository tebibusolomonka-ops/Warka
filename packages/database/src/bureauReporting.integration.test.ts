import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  approveSchoolReport,
  assignRequiredSchools,
  BureauAccessDeniedError,
  closeReportingPeriod,
  createDatabaseClient,
  createOrganization,
  createReportingPeriod,
  createSchool,
  createUser,
  DuplicateBureauAccessError,
  getReportingCoverage,
  grantBureauAccess,
  openReportingPeriod,
  prepareSchoolReport,
  requireBureauPermission,
  resolveBureauScope,
  returnSchoolReport,
  revokeBureauAccess,
  submitSchoolReport,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('bureau reporting in PostgreSQL', () => {
  it('persists scoped access, stable submissions, decisions, and coverage', async () => {
    const suffix = randomUUID()
    const organization = await createOrganization(database!, {
      name: `Bureau scope ${suffix}`,
    })
    const otherOrganization = await createOrganization(database!, {
      name: `Other scope ${suffix}`,
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Required school',
    })
    const manager = await createUser(database!, {
      email: `bureau-manager-${suffix}@example.test`,
      displayName: 'Report manager',
    })
    const schoolAdministrator = await createUser(database!, {
      email: `school-reporter-${suffix}@example.test`,
      displayName: 'School administrator',
    })
    const revokedUser = await createUser(database!, {
      email: `revoked-bureau-${suffix}@example.test`,
      displayName: 'Revoked viewer',
    })
    try {
      await grantBureauAccess(database!, {
        userId: manager.id,
        organizationId: organization.id,
        role: 'reportManager',
      })
      await expect(
        grantBureauAccess(database!, {
          userId: manager.id,
          organizationId: organization.id,
          role: 'viewer',
        }),
      ).rejects.toBeInstanceOf(DuplicateBureauAccessError)
      await grantBureauAccess(database!, {
        userId: revokedUser.id,
        organizationId: organization.id,
        role: 'viewer',
      })
      await revokeBureauAccess(database!, revokedUser.id, organization.id)
      expect(await resolveBureauScope(database!, revokedUser.id)).toEqual([])
      await expect(
        requireBureauPermission(
          database!,
          manager.id,
          otherOrganization.id,
          'view',
        ),
      ).rejects.toBeInstanceOf(BureauAccessDeniedError)
      await database!.schoolMembership.create({
        data: {
          userId: schoolAdministrator.id,
          schoolId: school.id,
          role: 'administrator',
        },
      })
      const period = await createReportingPeriod(database!, manager.id, {
        organizationId: organization.id,
        name: `Annual report ${suffix}`,
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-06-30'),
        submissionDueOn: new Date('2026-07-10'),
      })
      await assignRequiredSchools(database!, manager.id, period.id, [school.id])
      await openReportingPeriod(database!, manager.id, period.id)
      const originalSnapshot = {
        enrollment: { dataState: 'reported', total: 0 },
        academic: { dataState: 'reported', publishedResultCount: 0 },
      }
      const draft = await prepareSchoolReport(
        database!,
        schoolAdministrator.id,
        period.id,
        school.id,
        originalSnapshot,
      )
      await submitSchoolReport(
        database!,
        schoolAdministrator.id,
        period.id,
        school.id,
      )
      originalSnapshot.enrollment.total = 99
      expect(
        (
          await database!.reportingSubmission.findUniqueOrThrow({
            where: { id: draft.id },
          })
        ).snapshot,
      ).toEqual({
        enrollment: { dataState: 'reported', total: 0 },
        academic: { dataState: 'reported', publishedResultCount: 0 },
      })
      await returnSchoolReport(
        database!,
        manager.id,
        draft.id,
        'Correct the official source records',
      )
      expect(
        (
          await database!.reportingSubmission.findUniqueOrThrow({
            where: { id: draft.id },
          })
        ).status,
      ).toBe('returned')
      await prepareSchoolReport(
        database!,
        schoolAdministrator.id,
        period.id,
        school.id,
        { enrollment: { dataState: 'reported', total: 1 } },
      )
      await submitSchoolReport(
        database!,
        schoolAdministrator.id,
        period.id,
        school.id,
      )
      await approveSchoolReport(database!, manager.id, draft.id)
      const coverage = await getReportingCoverage(database!, period.id)
      expect(coverage.coverage).toMatchObject({
        expected: 1,
        approved: 1,
        missing: 0,
      })
      await closeReportingPeriod(database!, manager.id, period.id)
    } finally {
      await database!.reportingPeriod.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.bureauAccess.deleteMany({
        where: {
          organizationId: { in: [organization.id, otherOrganization.id] },
        },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.school.delete({ where: { id: school.id } })
      await database!.user.deleteMany({
        where: {
          id: { in: [manager.id, schoolAdministrator.id, revokedUser.id] },
        },
      })
      await database!.organization.deleteMany({
        where: { id: { in: [organization.id, otherOrganization.id] } },
      })
    }
  })
})
