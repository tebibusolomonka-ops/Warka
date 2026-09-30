import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'
import { expectAccessiblePage } from './accessibility.js'

const operatorId = '717ac602-fd66-4400-9116-13a79b8cc3da'

test('operator verifies a backup, rehearses restore, resolves an incident, and teacher is denied', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const journeyStart = new Date()
  const password = 'OperationsJourney123!'
  const ownerEmail = `operator-${suffix}@example.test`
  const teacherEmail = `operations-teacher-${suffix}@example.test`
  const schoolAdminEmail = `operations-admin-${suffix}@example.test`
  let organizationId = ''
  let schoolId = ''
  let teacherId = ''
  let schoolAdminId = ''
  let priorPolicy: Awaited<
    ReturnType<typeof database.backupPolicy.findUnique>
  > = null
  let priorBackupDates: Array<{ id: string; createdAt: Date }> = []
  let ownerCreated = false
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  const clickReady = async (name: string) => {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeEnabled({ timeout: 12_000 })
    await button.click({ timeout: 12_000 })
  }
  try {
    const organization = await database.organization.create({
      data: { name: `Operations Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Operations Browser School' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    await database.user.create({
      data: {
        id: operatorId,
        email: ownerEmail,
        displayName: 'Operations Owner',
        passwordCredential: { create: { passwordHash } },
        organizationMemberships: { create: { organizationId, role: 'owner' } },
      },
    })
    ownerCreated = true
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Operations Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    teacherId = teacher.id
    const schoolAdmin = await database.user.create({
      data: {
        email: schoolAdminEmail,
        displayName: 'Operations School Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    schoolAdminId = schoolAdmin.id

    await test.step('backup verification and isolated rehearsal', async () => {
      await signIn(ownerEmail)
      await expect(
        page.getByRole('heading', { name: 'Operations', exact: true }),
      ).toBeVisible({ timeout: 15_000 })
      await page.getByRole('link', { name: 'Deployment' }).click()
      await expect(
        page.getByRole('heading', { name: 'Deployment' }),
      ).toBeVisible()
      await expect(page.getByText('Application version: 0.1.0')).toBeVisible()
      await expect(page.getByText(/Migration status:/)).toBeVisible()
      await expect(
        page.locator('#operations-deployment').getByText('database: ready'),
      ).toBeVisible()
      await expect(
        page
          .locator('#operations-deployment')
          .getByText(/email: (disabled|available|unavailable)/),
      ).toBeVisible()
      await expectAccessiblePage(page)
      await clickReady('Run backup')
      await clickReady('Verify backup')
      await clickReady('Run restore rehearsal')
      await expect(page.getByText('Latest: succeeded')).toBeVisible({
        timeout: 15_000,
      })
    })

    await test.step('controlled scheduling, verification, failure, and retry', async () => {
      priorPolicy = await database.backupPolicy.findUnique({
        where: { id: 'database' },
      })
      await database.backupPolicy.upsert({
        where: { id: 'database' },
        create: {
          id: 'database',
          enabled: true,
          frequency: 'daily',
          retentionCount: 7,
          verificationRequired: true,
          updatedById: operatorId,
        },
        update: {
          enabled: true,
          frequency: 'daily',
          retentionCount: 7,
          verificationRequired: true,
          updatedById: operatorId,
        },
      })
      priorBackupDates = await database.backupRecord.findMany({
        select: { id: true, createdAt: true },
      })
      await database.backupRecord.updateMany({
        data: { createdAt: new Date(Date.now() - 172_800_000) },
      })
      expect(
        (await page.request.post('/api/__test/scheduler/tick')).status(),
      ).toBe(200)
      const scheduled = await database.scheduledTaskExecution.findFirstOrThrow({
        where: { taskType: 'backup', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      })
      expect(scheduled.resourceId).toBeTruthy()
      expect(
        await database.scheduledTaskExecution.count({
          where: {
            taskType: 'backupVerification',
            status: 'completed',
            resourceId: scheduled.resourceId,
          },
        }),
      ).toBe(1)
      await page.reload()
      await expect(page.getByLabel('Scheduled tasks')).toContainText(
        'backupVerification',
      )

      await database.backupRecord.updateMany({
        where: { createdById: operatorId },
        data: { createdAt: new Date(Date.now() - 172_800_000) },
      })
      expect(
        (await page.request.post('/api/__test/scheduler/fail-next')).status(),
      ).toBe(200)
      expect(
        (await page.request.post('/api/__test/scheduler/tick')).status(),
      ).toBe(500)
      const failed = await database.scheduledTaskExecution.findFirstOrThrow({
        where: { taskType: 'backup', status: 'failed' },
        orderBy: { createdAt: 'desc' },
      })
      await database.scheduledTaskExecution.update({
        where: { id: failed.id },
        data: { completedAt: new Date(Date.now() - 120_000) },
      })
      await page.reload()
      await expect(
        page.getByRole('button', { name: 'Retry scheduled task' }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Retry scheduled task' }).click()
      await expect
        .poll(async () =>
          database.scheduledTaskExecution.count({
            where: {
              seriesId: failed.seriesId,
              attempt: 2,
              status: 'completed',
            },
          }),
        )
        .toBe(1)
      expect(
        (await page.request.post('/api/__test/scheduler/tick')).status(),
      ).toBe(200)
      await page.reload()
      await expect(page.getByLabel('Scheduled tasks')).toContainText(
        'attempt 2',
      )
    })

    await test.step('incident timeline', async () => {
      await page
        .getByLabel('Incident title')
        .fill('Database service interruption')
      await page
        .getByLabel('Incident summary')
        .fill('Connections are temporarily unavailable')
      await page.getByRole('button', { name: 'Open incident' }).click()
      await page
        .getByRole('button', { name: 'Database service interruption' })
        .click()
      await page
        .getByLabel('Update message')
        .fill('Investigation found a recovered connection pool')
      await page.getByRole('button', { name: 'Add update' }).click()
      await expect(
        page.getByText(/Investigation found a recovered connection pool/),
      ).toBeVisible()
      await page
        .getByLabel('Update message')
        .fill('Monitoring the service after recovery')
      await clickReady('Move to monitoring')
      await expect(
        page.getByText(/monitoring: Monitoring the service after recovery/),
      ).toBeVisible()
      await page
        .getByLabel('Update message')
        .fill('Service has remained healthy')
      await clickReady('Resolve incident')
      await expect(page.getByText(/Service has remained healthy/)).toBeVisible()
      await expect(
        page.getByText(/Investigation found a recovered connection pool/),
      ).toBeVisible()
    })

    await test.step('teacher authorization boundary', async () => {
      await context.clearCookies()
      await signIn(teacherEmail)
      await expect(
        page.getByText('Signed in as Operations Teacher'),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Operations', exact: true }),
      ).toHaveCount(0)
      const denied = await page.request.post('/api/operations/backups')
      expect(denied.status()).toBe(403)
    })
    await test.step('school administrator cannot retry scheduled tasks', async () => {
      await context.clearCookies()
      await signIn(schoolAdminEmail)
      await expect(
        page.getByText('Signed in as Operations School Administrator'),
      ).toBeVisible()
      expect(
        (await page.request.get('/api/operations/deployment')).status(),
      ).toBe(403)
      const execution = await database.scheduledTaskExecution.findFirstOrThrow({
        where: { taskType: 'backup' },
        orderBy: { createdAt: 'desc' },
      })
      const denied = await page.request.post(
        `/api/operations/scheduler/executions/${execution.id}/retry`,
      )
      expect(denied.status()).toBe(403)
    })
  } finally {
    if (organizationId) {
      const createdUserIds = [
        ownerCreated ? operatorId : '',
        teacherId,
        schoolAdminId,
      ].filter(Boolean)
      await database.scheduledTaskExecution.deleteMany({
        where: { scope: 'database', createdAt: { gte: journeyStart } },
      })
      if (priorPolicy) {
        await database.backupPolicy.update({
          where: { id: 'database' },
          data: {
            enabled: priorPolicy.enabled,
            frequency: priorPolicy.frequency,
            retentionCount: priorPolicy.retentionCount,
            verificationRequired: priorPolicy.verificationRequired,
            updatedById: priorPolicy.updatedById,
          },
        })
      } else {
        await database.backupPolicy.deleteMany({
          where: { id: 'database', updatedById: operatorId },
        })
      }
      for (const backup of priorBackupDates)
        await database.backupRecord.updateMany({
          where: { id: backup.id },
          data: { createdAt: backup.createdAt },
        })
      const backups = ownerCreated
        ? await database.backupRecord.findMany({
            where: { createdById: operatorId },
            select: { id: true, storageReference: true },
          })
        : []
      await database.notification.deleteMany({
        where: { userId: { in: createdUserIds } },
      })
      await database.auditEvent.deleteMany({
        where: { actorUserId: { in: createdUserIds } },
      })
      if (ownerCreated) {
        await database.restoreRehearsal.deleteMany({
          where: { performedById: operatorId },
        })
        await database.backupRecord.deleteMany({
          where: { createdById: operatorId },
        })
        await database.operationalIncidentUpdate.deleteMany({
          where: { createdById: operatorId },
        })
        await database.operationalIncident.deleteMany({
          where: { createdById: operatorId },
        })
      }
      await database.session.deleteMany({
        where: { userId: { in: createdUserIds } },
      })
      await database.user.deleteMany({ where: { id: { in: createdUserIds } } })
      if (schoolId) await database.school.delete({ where: { id: schoolId } })
      await database.organization.delete({ where: { id: organizationId } })
      for (const backup of backups)
        if (backup.storageReference)
          await rm(
            join(
              process.cwd(),
              'apps/api/.backups/e2e',
              `${backup.storageReference}.dump`,
            ),
            { force: true },
          )
    }
    await database.$disconnect()
  }
})
