import { afterAll, describe, expect, it } from 'vitest'
import {
  completeScheduledTask,
  createDatabaseClient,
  failScheduledTask,
  startScheduledTask,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('scheduled execution history in PostgreSQL', () => {
  it('persists completed and failed backup attempts without unsafe errors', async () => {
    const completed = await startScheduledTask(
      database!,
      'backup',
      'database',
      new Date('2026-09-27T12:00:00Z'),
    )
    const failed = await startScheduledTask(
      database!,
      'backup',
      'database',
      new Date('2026-09-27T12:01:00Z'),
      undefined,
      2,
    )
    try {
      await completeScheduledTask(database!, completed.id, 'backup-record')
      await failScheduledTask(database!, failed.id, 'BACKUP_FAILED')
      expect(
        await database!.scheduledTaskExecution.findUniqueOrThrow({
          where: { id: completed.id },
        }),
      ).toMatchObject({ status: 'completed', resourceId: 'backup-record' })
      expect(
        await database!.scheduledTaskExecution.findUniqueOrThrow({
          where: { id: failed.id },
        }),
      ).toMatchObject({
        status: 'failed',
        attempt: 2,
        failureCode: 'BACKUP_FAILED',
      })
    } finally {
      await database!.scheduledTaskExecution.deleteMany({
        where: { id: { in: [completed.id, failed.id] } },
      })
    }
  })
})
