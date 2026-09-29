import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'
import { runStartupReconciliation } from '../../apps/api/dist/startupReconciliation.js'

const operatorId = '717ac602-fd66-4400-9116-13a79b8cc3da'

test('operator recovers safe interrupted work while ambiguous delivery stays held', async ({
  page,
  context,
}) => {
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'RecoveryJourney123!'
  const ownerEmail = `recovery-owner-${suffix}@example.test`
  const adminEmail = `recovery-admin-${suffix}@example.test`
  let organizationId = ''
  let schoolId = ''
  let adminId = ''
  let policyId = ''
  let executionId = ''
  let deliveryId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Recovery Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Recovery Browser School' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    await database.user.create({
      data: {
        id: operatorId,
        email: ownerEmail,
        displayName: 'Recovery Owner',
        passwordCredential: { create: { passwordHash } },
        organizationMemberships: { create: { organizationId, role: 'owner' } },
      },
    })
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Recovery School Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    adminId = admin.id
    const policy = await database.retentionPolicy.create({
      data: {
        organizationId,
        category: 'auditEvents',
        retentionDays: 30,
        updatedById: operatorId,
      },
    })
    policyId = policy.id
    const expired = new Date(Date.now() - 600_000)
    const execution = await database.scheduledTaskExecution.create({
      data: {
        taskType: 'retentionEvaluation',
        scope: organizationId,
        resourceId: policy.id,
        scheduledFor: expired,
        startedAt: expired,
        claimedAt: expired,
        heartbeatAt: expired,
        leaseExpiresAt: new Date(Date.now() - 300_000),
        workerId: `worker_${randomUUID()}`,
        status: 'running',
      },
    })
    executionId = execution.id
    const delivery = await database.emailDelivery.create({
      data: {
        recipientUserId: operatorId,
        recipientAddress: ownerEmail,
        templateKey: 'accountSuspended',
        status: 'sending',
        startedAt: expired,
        attemptCount: 1,
      },
    })
    deliveryId = delivery.id
    await database.scheduledTaskExecution.create({
      data: {
        taskType: 'emailDelivery',
        scope: 'transactional_email',
        resourceId: delivery.id,
        scheduledFor: expired,
        startedAt: expired,
        claimedAt: expired,
        heartbeatAt: expired,
        leaseExpiresAt: new Date(Date.now() - 300_000),
        workerId: `worker_${randomUUID()}`,
        status: 'running',
      },
    })
    await runStartupReconciliation(database, { now: new Date() })
    expect(
      (
        await database.emailDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
    ).toBe('deliveryUnknown')
    expect(
      await database.scheduledTaskExecution.count({
        where: { taskType: 'emailDelivery', resourceId: delivery.id },
      }),
    ).toBe(1)

    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(ownerEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible()
    await expect(page.getByLabel('Interrupted executions')).toContainText(
      'retentionEvaluation · safeToRetry',
    )
    await page.getByRole('button', { name: 'Retry safe task' }).click()
    await expect
      .poll(
        async () =>
          (
            await database.scheduledTaskExecution.findUniqueOrThrow({
              where: { id: execution.id },
            })
          ).status,
      )
      .toBe('failed')
    expect(
      (await page.request.post('/api/__test/scheduler/tick')).status(),
    ).toBe(200)
    await expect
      .poll(() =>
        database.scheduledTaskExecution.count({
          where: { seriesId: execution.seriesId, status: 'completed' },
        }),
      )
      .toBe(1)

    await context.clearCookies()
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(adminEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Recovery' })).toHaveCount(0)
  } finally {
    if (executionId || deliveryId)
      await database.scheduledTaskExecution.deleteMany({
        where: {
          OR: [
            ...(executionId ? [{ id: executionId }] : []),
            ...(deliveryId ? [{ resourceId: deliveryId }] : []),
          ],
        },
      })
    if (deliveryId)
      await database.recoveryReview.deleteMany({
        where: { resourceReference: deliveryId },
      })
    if (deliveryId)
      await database.emailDelivery.deleteMany({ where: { id: deliveryId } })
    if (policyId)
      await database.retentionPolicy.deleteMany({ where: { id: policyId } })
    if (adminId) await database.user.deleteMany({ where: { id: adminId } })
    await database.user.deleteMany({ where: { id: operatorId } })
    if (schoolId) await database.school.deleteMany({ where: { id: schoolId } })
    if (organizationId)
      await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
