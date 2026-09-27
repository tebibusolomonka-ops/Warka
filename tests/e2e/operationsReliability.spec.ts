import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

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
  const password = 'OperationsJourney123!'
  const ownerEmail = `operator-${suffix}@example.test`
  const teacherEmail = `operations-teacher-${suffix}@example.test`
  let organizationId = ''
  let schoolId = ''
  let teacherId = ''
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

    await test.step('backup verification and isolated rehearsal', async () => {
      await signIn(ownerEmail)
      await expect(
        page.getByRole('heading', { name: 'Operations', exact: true }),
      ).toBeVisible({ timeout: 15_000 })
      await clickReady('Run backup')
      await clickReady('Verify backup')
      await clickReady('Run restore rehearsal')
      await expect(page.getByText('Latest: succeeded')).toBeVisible({
        timeout: 15_000,
      })
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
  } finally {
    if (organizationId) {
      const createdUserIds = [ownerCreated ? operatorId : '', teacherId].filter(
        Boolean,
      )
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
