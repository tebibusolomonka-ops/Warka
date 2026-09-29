import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

const operatorId = '717ac602-fd66-4400-9116-13a79b8cc3da'

test('operator sees safe performance health while school administrator is denied', async ({
  page,
  context,
}) => {
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'PerformanceJourney123!'
  const ownerEmail = `performance-owner-${suffix}@example.test`
  const adminEmail = `performance-admin-${suffix}@example.test`
  let organizationId = ''
  let schoolId = ''
  let adminId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Performance Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Performance Browser School' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    await database.user.create({
      data: {
        id: operatorId,
        email: ownerEmail,
        displayName: 'Performance Owner',
        passwordCredential: { create: { passwordHash } },
        organizationMemberships: { create: { organizationId, role: 'owner' } },
      },
    })
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Performance School Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    adminId = admin.id

    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(ownerEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'Performance', exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/Database readiness: ready/)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Request categories' }),
    ).toBeVisible()
    await expect(page.locator('#operations-performance')).not.toContainText(
      'SELECT ',
    )

    await context.clearCookies()
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(adminEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'Performance', exact: true }),
    ).toHaveCount(0)
  } finally {
    if (adminId) await database.user.deleteMany({ where: { id: adminId } })
    await database.user.deleteMany({ where: { id: operatorId } })
    if (schoolId) await database.school.deleteMany({ where: { id: schoolId } })
    if (organizationId)
      await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
