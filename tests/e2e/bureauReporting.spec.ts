import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('bureau manager approves a school report with viewer boundary', async ({
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
  const userIds: string[] = []
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(email)
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

    await context.clearCookies()
    await signIn(managerEmail)
    await expect(
      page
        .getByRole('region', { name: 'Required schools' })
        .getByText('Required Browser School — submitted'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(
      page
        .getByRole('region', { name: 'Required schools' })
        .getByText('Required Browser School — approved'),
    ).toBeVisible()

    await context.clearCookies()
    await signIn(viewerEmail)
    await expect(
      page.getByRole('heading', { name: 'Bureau reporting' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create reporting period' }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  } finally {
    if (periodId)
      await database.reportingPeriod.deleteMany({ where: { id: periodId } })
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
