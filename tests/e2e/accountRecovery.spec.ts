import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword, createSession } from '../../packages/auth/dist/index.js'

test('account security, recovery, and administrator scope', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const initial = 'InitialRecovery123!'
  const changed = 'ChangedRecovery123!'
  const recovered = 'RecoveredAgain123!'
  const email = `security-admin-${suffix}@example.test`
  let organizationId = '',
    otherOrganizationId = '',
    schoolId = '',
    otherSchoolId = '',
    adminId = '',
    targetId = '',
    outsiderId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Security Org ${suffix}` },
    })
    organizationId = organization.id
    const otherOrganization = await database.organization.create({
      data: { name: `Other Security Org ${suffix}` },
    })
    otherOrganizationId = otherOrganization.id
    const school = await database.school.create({
      data: { organizationId, name: `Security School ${suffix}` },
    })
    schoolId = school.id
    const otherSchool = await database.school.create({
      data: {
        organizationId: otherOrganizationId,
        name: `Other Security School ${suffix}`,
      },
    })
    otherSchoolId = otherSchool.id
    const passwordHash = await hashPassword(initial)
    const admin = await database.user.create({
      data: {
        email,
        displayName: 'Security Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    adminId = admin.id
    const target = await database.user.create({
      data: {
        email: `security-target-${suffix}@example.test`,
        displayName: 'Security Target',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    targetId = target.id
    const outsider = await database.user.create({
      data: {
        email: `security-outsider-${suffix}@example.test`,
        displayName: 'Security Outsider',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: {
          create: { schoolId: otherSchoolId, role: 'teacher' },
        },
      },
    })
    outsiderId = outsider.id
    const signIn = async (password: string) => {
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in' }).click()
    }
    await signIn(initial)
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Account security' }).click()
    await expect(page.getByText('Current session')).toBeVisible()
    await page.getByLabel('Current password').fill(initial)
    await page.getByLabel('New password', { exact: true }).fill(changed)
    await page.getByLabel('Confirm new password').fill(changed)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Password changed')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(initial)
    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await signIn(changed)
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page.getByLabel('User ID').fill(targetId)
    await page.getByRole('button', { name: 'Initiate recovery' }).click()
    await expect(page.getByText('Recovery initiated')).toBeVisible()
    const assisted = await page.request.get(
      `/api/__test/recovery-token/${encodeURIComponent(target.email)}`,
    )
    expect(assisted.status()).toBe(200)
    await page.getByLabel('User ID').fill(outsiderId)
    await page.getByRole('button', { name: 'Initiate recovery' }).click()
    await expect(page.getByText('Could not initiate recovery')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Recovery email').fill(email)
    await page.getByRole('button', { name: 'Request recovery' }).click()
    await expect(
      page.getByText(
        'If the account exists, recovery instructions will be sent.',
      ),
    ).toBeVisible()
    const delivery = await page.request.get(
      `/api/__test/recovery-token/${encodeURIComponent(email)}`,
    )
    expect(delivery.status()).toBe(200)
    const { token } = (await delivery.json()) as { token: string }
    const oldSession = await createSession(database, adminId)
    await page.getByLabel('Recovery token').fill(token)
    await page.getByLabel('New recovery password').fill(recovered)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(
      page.getByText('Password reset. Sign in with your new password.'),
    ).toBeVisible()
    expect(
      await database.session.findFirst({
        where: {
          userId: adminId,
          tokenHash: (
            await import('../../packages/auth/dist/index.js')
          ).hashSessionToken(oldSession.token),
        },
      }),
    ).toBeNull()
    await page.getByLabel('Recovery token').fill(token)
    await page.getByLabel('New recovery password').fill(recovered)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(
      page.getByText('Invalid or expired recovery token'),
    ).toBeVisible()
    await signIn(recovered)
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
  } finally {
    if (schoolId) await database.auditEvent.deleteMany({ where: { schoolId } })
    await database.auditEvent.deleteMany({
      where: { actorUserId: { in: [adminId, targetId, outsiderId] } },
    })
    await database.session.deleteMany({
      where: { userId: { in: [adminId, targetId, outsiderId] } },
    })
    await database.user.deleteMany({
      where: { id: { in: [adminId, targetId, outsiderId] } },
    })
    if (schoolId) await database.school.delete({ where: { id: schoolId } })
    if (otherSchoolId)
      await database.school.delete({ where: { id: otherSchoolId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    if (otherOrganizationId)
      await database.organization.delete({ where: { id: otherOrganizationId } })
    await database.$disconnect()
  }
})
