import { buildApp } from './app.js'
import { serverConfig } from './config.js'
import { BackupScheduler, schedulerConfiguration } from './backupScheduler.js'
import { createDatabaseClient } from '@warka/database'

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
  scheduler?.start(() => app.log.error('Backup scheduler poll failed'))
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
