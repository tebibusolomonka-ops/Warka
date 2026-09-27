import { writeFile } from 'node:fs/promises'
import type { BackupRouteActions } from './backupRoutes.js'
import { executeBackup } from './backupService.js'
import { verifyBackup } from './backupVerification.js'
import { runRestoreRehearsal } from './restoreRehearsal.js'

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
