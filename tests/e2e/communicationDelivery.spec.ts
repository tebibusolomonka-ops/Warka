import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { createSession, hashPassword } from '../../packages/auth/dist/index.js'

test('notification email, digest, and delivery history stay inside the user boundary', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const email = `communication-${suffix}@example.test`
  const otherEmail = `other-communication-${suffix}@example.test`
  const userIds: string[] = []
  try {
    const passwordHash = await hashPassword('Communication123!')
    const user = await database.user.create({
      data: {
        email,
        displayName: 'Communication Tester',
        passwordCredential: { create: { passwordHash } },
      },
    })
    const other = await database.user.create({
      data: {
        email: otherEmail,
        displayName: 'Other Communication Tester',
        passwordCredential: { create: { passwordHash } },
      },
    })
    userIds.push(user.id, other.id)
    const session = await createSession(database, user.id)
    await context.addCookies([
      {
        name: 'warka_session',
        value: session.token,
        url: 'http://127.0.0.1:4173',
      },
    ])
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Communication preferences' }),
    ).toBeVisible()
    await page.getByLabel('School announcements email').check()
    await expect(page.getByLabel('School announcements email')).toBeChecked()
    await database.notification.create({
      data: {
        userId: user.id,
        type: 'announcement.published',
        title: 'Announcement ready',
        message: 'Private detail stays in Warka',
      },
    })
    expect((await page.request.post('/api/__test/email-tick')).status()).toBe(
      200,
    )
    const sent = await page.request.get(
      `/api/__test/email-messages/${encodeURIComponent(email)}`,
    )
    const messages = (await sent.json()).messages as Array<{
      subject: string
      text: string
    }>
    const update = messages.find(
      (item) => item.subject === 'An update is available in Warka',
    )
    expect(update).toBeDefined()
    expect(update!.text).not.toContain('Private detail')
    const link = update!.text.match(/http:\/\/localhost:4173\/#[^\s]+/)?.[0]
    expect(link).toBe('http://localhost:4173/#resources-heading')
    const history = await page.request.get('/api/me/email-deliveries?take=1')
    expect(history.status()).toBe(200)
    expect((await history.json()).deliveries).toEqual([
      expect.objectContaining({ kind: 'Warka update', status: 'sent' }),
    ])
    expect(await history.text()).not.toContain(email)

    await page.getByLabel('School announcements digest').selectOption('daily')
    await expect
      .poll(
        async () =>
          (
            await database.notificationPreference.findUnique({
              where: {
                userId_category: {
                  userId: user.id,
                  category: 'schoolAnnouncements',
                },
              },
            })
          )?.digestCadence,
      )
      .toBe('daily')
    const yesterday = new Date()
    yesterday.setUTCHours(0, 0, 0, 0)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const preferenceAt = new Date(yesterday.getTime() + 60_000)
    await database.notificationPreference.update({
      where: {
        userId_category: { userId: user.id, category: 'schoolAnnouncements' },
      },
      data: { updatedAt: preferenceAt },
    })
    await database.notification.create({
      data: {
        userId: user.id,
        type: 'announcement.published',
        title: 'Yesterday announcement',
        message: 'Private digest detail',
        createdAt: new Date(yesterday.getTime() + 120_000),
        emailRoutedAt: new Date(),
      },
    })
    await expect
      .poll(async () => {
        expect(
          (await page.request.post('/api/__test/email-tick')).status(),
        ).toBe(200)
        return database.emailDigest.count({ where: { userId: user.id } })
      })
      .toBe(1)
    await expect
      .poll(async () => {
        expect(
          (await page.request.post('/api/__test/email-tick')).status(),
        ).toBe(200)
        const digest = await database.emailDigest.findFirst({
          where: { userId: user.id },
          include: { delivery: true },
        })
        return digest?.delivery?.status
      })
      .toBe('sent')
    const digests = await database.emailDigest.findMany({
      where: { userId: user.id },
      include: { delivery: true },
    })
    expect(digests).toHaveLength(1)
    expect(digests[0]!.delivery?.status).toBe('sent')
    const after = await page.request.get(
      `/api/__test/email-messages/${encodeURIComponent(email)}`,
    )
    const afterMessages = (await after.json()).messages as Array<{
      subject: string
    }>
    expect(
      afterMessages.filter(
        (item) => item.subject === 'Your Warka update digest',
      ),
    ).toHaveLength(1)

    const otherSession = await createSession(database, other.id)
    await context.addCookies([
      {
        name: 'warka_session',
        value: otherSession.token,
        url: 'http://127.0.0.1:4173',
      },
    ])
    const otherHistory = await page.request.get('/api/me/email-deliveries')
    expect(otherHistory.status()).toBe(200)
    expect((await otherHistory.json()).deliveries).toEqual([])
    await context.clearCookies()
    expect((await page.request.get('/api/me/email-deliveries')).status()).toBe(
      401,
    )
    await page.goto(link!)
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  } finally {
    const deliveries = await database.emailDelivery.findMany({
      where: { recipientUserId: { in: userIds } },
      select: { id: true },
    })
    await database.scheduledTaskExecution.deleteMany({
      where: { resourceId: { in: deliveries.map((item) => item.id) } },
    })
    await database.emailDelivery.deleteMany({
      where: { recipientUserId: { in: userIds } },
    })
    await database.notification.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.emailDigest.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.notificationPreference.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.session.deleteMany({ where: { userId: { in: userIds } } })
    await database.auditEvent.deleteMany({
      where: { actorUserId: { in: userIds } },
    })
    await database.user.deleteMany({ where: { id: { in: userIds } } })
    await database.$disconnect()
  }
})
