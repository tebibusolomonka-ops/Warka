import { buildApp } from './app.js'
import { serverConfig } from './config.js'
import { BackupScheduler, schedulerConfiguration } from './backupScheduler.js'
import { createDatabaseClient } from '@warka/database'
import { schedulerHealth } from './schedulerHealth.js'

const app = buildApp()
const schedulerConfig = schedulerConfiguration(process.env)
const schedulerDatabase = schedulerConfig.enabled
  ? createDatabaseClient()
  : undefined
const scheduler = schedulerDatabase
  ? new BackupScheduler(schedulerDatabase, schedulerConfig)
  : undefined
app.addHook('onClose', async () => {
  await scheduler?.stop()
  await schedulerDatabase?.$disconnect()
})

try {
  await app.listen(serverConfig(process.env))
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.WARKA_SCHEDULER_CONTROLLED_TEST === 'enabled'
  )
    schedulerHealth.configure(
      schedulerConfig.enabled,
      schedulerConfig.intervalMs,
    )
  else scheduler?.start(() => app.log.error('Backup scheduler poll failed'))
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
