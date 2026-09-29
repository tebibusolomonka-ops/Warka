import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('school report return, correction, resubmission and accepted version preserve history', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000)
  const suffix = randomUUID()
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const managerEmail = `bureau-manager-${suffix}@example.test`
  const viewerEmail = `bureau-viewer-${suffix}@example.test`
  const schoolEmail = `bureau-school-${suffix}@example.test`
  const password = 'ReportingPassphrase123!'
  let organizationId = ''
  let schoolId = ''
  let periodId = ''
  let studentId = ''
  let academicYearId = ''
  let gradeLevelId = ''
  const userIds: string[] = []
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  try {
    const organization = await database.organization.create({
      data: { name: `Bureau Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Required Browser School' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    const manager = await database.user.create({
      data: {
        email: managerEmail,
        displayName: 'Bureau Report Manager',
        passwordCredential: { create: { passwordHash } },
        bureauAccesses: { create: { organizationId, role: 'reportManager' } },
      },
    })
    const viewer = await database.user.create({
      data: {
        email: viewerEmail,
        displayName: 'Bureau Viewer',
        passwordCredential: { create: { passwordHash } },
        bureauAccesses: { create: { organizationId, role: 'viewer' } },
      },
    })
    const schoolAdministrator = await database.user.create({
      data: {
        email: schoolEmail,
        displayName: 'School Reporting Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    userIds.push(manager.id, viewer.id, schoolAdministrator.id)
    const period = await database.reportingPeriod.create({
      data: {
        organizationId,
        name: 'Browser Annual Report',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-06-30'),
        submissionDueOn: new Date('2026-07-10'),
        status: 'open',
        requirements: { create: { schoolId } },
      },
    })
    periodId = period.id

    await signIn(managerEmail)
    await expect(
      page.getByRole('heading', { name: 'Bureau reporting' }),
    ).toBeVisible()
    await expect(
      page.getByText('Required Browser School — missing'),
    ).toBeVisible()

    await context.clearCookies()
    await signIn(schoolEmail)
    await expect(
      page.getByRole('heading', { name: 'Reporting', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Preview report' }).click()
    await expect(
      page.getByText('Preview prepared from official records.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Submit report' }).click()
    await expect(page.getByText('Report submitted.')).toBeVisible()
    const firstVersion =
      await database.reportingSubmissionVersion.findFirstOrThrow({
        where: { submission: { reportingPeriodId: periodId, schoolId } },
      })
    expect(firstVersion.version).toBe(1)

    await context.clearCookies()
    await signIn(managerEmail)
    await expect(
      page
        .getByRole('region', { name: 'Required schools' })
        .getByText('Required Browser School — submitted'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Review details' }).click()
    await page.getByRole('button', { name: 'Start review' }).click()
    await page
      .getByLabel('Review note')
      .fill('Internal check of aggregate source')
    await page.getByLabel('Note visibility').selectOption('bureauInternal')
    await page.getByRole('button', { name: 'Add review note' }).click()
    await expect(
      page.getByText(/Internal check of aggregate source/),
    ).toBeVisible()
    await page
      .getByLabel('Return reason')
      .fill('Add the approved enrollment to the official aggregate')
    await page.getByRole('button', { name: 'Return', exact: true }).click()
    await expect(
      page
        .getByRole('region', { name: 'Required schools' })
        .getByText(/Required Browser School — returned/),
    ).toBeVisible()

    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: '2026 Browser Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    academicYearId = year.id
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Grade 1' },
    })
    gradeLevelId = grade.id
    const student = await database.student.create({
      data: { studentReference: `WKA-${suffix}`, givenName: 'Browser' },
    })
    studentId = student.id
    await database.enrollment.create({
      data: {
        studentId,
        schoolId,
        academicYearId,
        gradeLevelId,
        status: 'approved',
        approvedAt: new Date('2026-06-15'),
        approvedById: schoolAdministrator.id,
      },
    })

    await context.clearCookies()
    await signIn(schoolEmail)
    await expect(page.getByText(/Add the approved enrollment/)).toBeVisible()
    await expect(
      page.getByText(/Internal check of aggregate source/),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        async ({ organizationId, submissionId }) =>
          (
            await fetch(
              `/api/bureau/${organizationId}/submissions/${submissionId}/notes`,
              { credentials: 'include' },
            )
          ).status,
        { organizationId, submissionId: firstVersion.submissionId },
      ),
    ).toBe(403)
    await page.getByRole('button', { name: 'Preview report' }).click()
    await expect(
      page.getByText('Preview prepared from official records.'),
    ).toBeVisible()
    await page
      .getByLabel('Resubmission reason')
      .fill('Approved enrollment added to source')
    await page.getByRole('button', { name: 'Resubmit report' }).click()
    await expect(page.getByText('Report resubmitted.')).toBeVisible()
    const versions = await database.reportingSubmissionVersion.findMany({
      where: { submission: { reportingPeriodId: periodId, schoolId } },
      orderBy: { version: 'asc' },
    })
    expect(versions.map((version) => version.version)).toEqual([1, 2])
    expect(versions[0]?.snapshot).toEqual(firstVersion.snapshot)
    expect(versions[1]?.snapshot).not.toEqual(firstVersion.snapshot)

    await context.clearCookies()
    await signIn(managerEmail)
    await page.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(
      page
        .getByRole('region', { name: 'Required schools' })
        .getByText('Required Browser School — approved'),
    ).toBeVisible()
    const accepted = await database.reportingSubmission.findFirstOrThrow({
      where: { reportingPeriodId: periodId, schoolId },
    })
    expect(accepted.acceptedVersion).toBe(2)

    await context.clearCookies()
    await signIn(schoolEmail)
    await expect(page.getByText('Accepted version: 2')).toBeVisible()

    await context.clearCookies()
    await signIn(viewerEmail)
    await expect(
      page.getByRole('heading', { name: 'Bureau reporting' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create reporting period' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Accept', exact: true }),
    ).toHaveCount(0)
  } finally {
    if (periodId)
      await database.reportingPeriod.deleteMany({ where: { id: periodId } })
    if (studentId)
      await database.enrollment.deleteMany({ where: { studentId } })
    if (academicYearId)
      await database.academicYear.deleteMany({ where: { id: academicYearId } })
    if (gradeLevelId)
      await database.gradeLevel.deleteMany({ where: { id: gradeLevelId } })
    if (studentId)
      await database.student.deleteMany({ where: { id: studentId } })
    if (organizationId)
      await database.bureauAccess.deleteMany({ where: { organizationId } })
    if (schoolId)
      await database.schoolMembership.deleteMany({ where: { schoolId } })
    if (userIds.length)
      await database.user.deleteMany({ where: { id: { in: userIds } } })
    if (schoolId) await database.school.deleteMany({ where: { id: schoolId } })
    if (organizationId)
      await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})

test('blank required aggregate blocks submission without becoming zero', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const suffix = randomUUID()
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const password = 'ReportingValidation123!'
  let organizationId = ''
  let schoolId = ''
  let periodId = ''
  let userId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Reporting validation ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Validation school' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    const user = await database.user.create({
      data: {
        email: `reporting-validation-${suffix}@example.test`,
        displayName: 'Validation administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    userId = user.id
    const period = await database.reportingPeriod.create({
      data: {
        organizationId,
        name: 'Validation period',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-06-30'),
        submissionDueOn: new Date('2026-07-10'),
        status: 'open',
        requirements: { create: { schoolId } },
      },
    })
    periodId = period.id
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'Reporting', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Preview report' }).click()
    await expect(page.getByText('Ready to submit')).toBeVisible()
    await database.reportingSubmission.update({
      where: {
        reportingPeriodId_schoolId: { reportingPeriodId: periodId, schoolId },
      },
      data: {
        snapshot: {
          enrollment: { dataState: 'unknown' },
          academic: {
            dataState: 'reported',
            publishedResultCount: 0,
            outcomes: [],
          },
          activity: {
            transfers: { confirmed: 0, unresolved: 0, rejected: 0 },
            verification: {
              active: 0,
              corrected: 0,
              withdrawn: 0,
              unavailable: 0,
            },
          },
        },
      },
    })
    await page.reload()
    await expect(page.getByText('Submission blocked')).toBeVisible()
    await expect(
      page.getByText(/REPORTING_ENROLLMENT_NOT_REPORTED/),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Submit report' }),
    ).toBeDisabled()
    expect(
      (
        await database.reportingSubmission.findFirstOrThrow({
          where: { reportingPeriodId: periodId, schoolId },
        })
      ).status,
    ).toBe('draft')
    expect(
      await database.reportingSubmissionVersion.count({
        where: { submission: { reportingPeriodId: periodId, schoolId } },
      }),
    ).toBe(0)
  } finally {
    if (periodId)
      await database.reportingPeriod.deleteMany({ where: { id: periodId } })
    if (schoolId)
      await database.schoolMembership.deleteMany({ where: { schoolId } })
    if (userId) await database.user.deleteMany({ where: { id: userId } })
    if (schoolId) await database.school.deleteMany({ where: { id: schoolId } })
    if (organizationId)
      await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
