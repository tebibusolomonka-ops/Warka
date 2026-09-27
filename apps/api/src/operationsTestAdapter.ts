import { writeFile } from 'node:fs/promises'
import type { BackupRouteActions } from './backupRoutes.js'
import { executeBackup } from './backupService.js'
import { verifyBackup } from './backupVerification.js'
import { runRestoreRehearsal } from './restoreRehearsal.js'

let failNextScheduledBackup = false

export function failNextSchedulerBackup() {
  failNextScheduledBackup = true
}

export function schedulerTestActions() {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.WARKA_SCHEDULER_CONTROLLED_TEST !== 'enabled'
  )
    return undefined
  return {
    backup: (input: Parameters<typeof executeBackup>[0]) =>
      executeBackup({
        ...input,
        process: {
          dump: async (_connection, destination) => {
            if (failNextScheduledBackup) {
              failNextScheduledBackup = false
              throw new Error('Controlled backup failure')
            }
            await writeFile(
              destination,
              'Warka controlled scheduled backup artifact',
            )
          },
        },
      }),
    verify: (input: Parameters<typeof verifyBackup>[0]) =>
      verifyBackup({ ...input, inspector: { inspect: async () => undefined } }),
  }
}

export function operationsTestActions():
  Partial<BackupRouteActions> | undefined {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.OPERATIONS_TEST_ADAPTER !== 'enabled'
  )
    return undefined
  return {
    backup: (input) =>
      executeBackup({
        ...input,
        process: {
          dump: async (_connection, destination) => {
            await writeFile(
              destination,
              'Warka controlled browser backup artifact',
            )
          },
        },
      }),
    verify: (input) =>
      verifyBackup({ ...input, inspector: { inspect: async () => undefined } }),
    rehearse: (input) =>
      runRestoreRehearsal({
        ...input,
        process: {
          create: async () => undefined,
          restore: async () => undefined,
          check: async () => undefined,
          drop: async () => undefined,
        },
      }),
  }
}
