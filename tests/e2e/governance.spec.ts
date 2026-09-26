import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('organization administrator completes an access review with support boundary', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000)
  const suffix = randomUUID()
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const password = 'GovernancePassphrase123!'
  const administratorEmail = `governance-admin-${suffix}@example.test`
  const teacherEmail = `governance-teacher-${suffix}@example.test`
  const registrarEmail = `governance-registrar-${suffix}@example.test`
  const supportEmail = `governance-support-${suffix}@example.test`
  let organizationId = ''
  let schoolId = ''
  const userIds: string[] = []
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  try {
    const organization = await database.organization.create({
      data: { name: `Governance Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Governed Browser School' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    const administrator = await database.user.create({
      data: {
        email: administratorEmail,
        displayName: 'Governance Administrator',
        passwordCredential: { create: { passwordHash } },
        organizationMemberships: {
          create: { organizationId, role: 'administrator' },
        },
      },
    })
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Reviewed Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    const registrar = await database.user.create({
      data: {
        email: registrarEmail,
        displayName: 'Reviewed Registrar',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'registrar' } },
      },
    })
    const support = await database.user.create({
      data: {
        email: supportEmail,
        displayName: 'Pending Support User',
        passwordCredential: { create: { passwordHash } },
        supportIdentity: { create: {} },
      },
    })
    userIds.push(administrator.id, teacher.id, registrar.id, support.id)
    await database.supportAccessGrant.create({
      data: {
        supportUserId: support.id,
        schoolId,
        requestedById: support.id,
        reason: 'Pending browser diagnostic request',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    await signIn(administratorEmail)
    await expect(
      page.getByRole('heading', { name: 'Security governance' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Create access review' }).click()
    await expect(page.getByText('Access review created.')).toBeVisible()
    await page
      .getByRole('button', { name: 'Confirm Governance Administrator' })
      .click()
    await page
      .getByRole('button', { name: 'Confirm Reviewed Registrar' })
      .click()
    await page
      .getByRole('button', { name: 'Mark Reviewed Teacher for revocation' })
      .click()
    const complete = page.getByRole('button', {
      name: 'Complete access review',
    })
    await expect(complete).toBeEnabled()
    await complete.click()
    await expect(page.getByText('Access review completed.')).toBeVisible()
    await expect
      .poll(() =>
        database.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: teacher.id, schoolId },
          },
        }),
      )
      .toBeNull()

    await context.clearCookies()
    await signIn(supportEmail)
    await expect(
      page.getByRole('heading', { name: 'Security governance' }),
    ).toHaveCount(0)
    const denied = await page.request.get(
      `/api/governance/${organizationId}/audit`,
    )
    expect(denied.status()).toBe(403)
  } finally {
    if (organizationId)
      await database.auditEvent.deleteMany({ where: { organizationId } })
    if (organizationId)
      await database.accessReview.deleteMany({ where: { organizationId } })
    if (schoolId)
      await database.supportAccessGrant.deleteMany({ where: { schoolId } })
    if (userIds.length)
      await database.supportIdentity.deleteMany({
        where: { userId: { in: userIds } },
      })
    if (schoolId)
      await database.schoolMembership.deleteMany({ where: { schoolId } })
    if (organizationId)
      await database.organizationMembership.deleteMany({
        where: { organizationId },
      })
    if (schoolId) await database.school.deleteMany({ where: { id: schoolId } })
    if (userIds.length)
      await database.user.deleteMany({ where: { id: { in: userIds } } })
    if (organizationId)
      await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
