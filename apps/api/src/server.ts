import { buildApp } from './app.js'
import { serverConfig } from './config.js'
import { BackupScheduler, schedulerConfiguration } from './backupScheduler.js'
import { createDatabaseClient } from '@warka/database'
import { schedulerHealth } from './schedulerHealth.js'
import {
  FileScanScheduler,
  fileScanSchedulerConfiguration,
} from './fileScanScheduler.js'
import {
  EmailOutboxScheduler,
  emailOutboxConfiguration,
} from './emailOutboxScheduler.js'
import { FakeEmailProvider } from './emailProvider.js'
import { assertProductionConfiguration } from './productionConfiguration.js'
import { environmentProfile } from './environmentProfile.js'
import { createApplicationShutdown } from './applicationShutdown.js'
import { buildMetadata } from './buildMetadata.js'
import { runStartupReconciliation } from './startupReconciliation.js'

const profile = environmentProfile(process.env)
assertProductionConfiguration(process.env)

const controlledEmail =
  process.env.NODE_ENV === 'test' &&
  process.env.RECOVERY_TEST_DELIVERY === 'enabled' &&
  process.env.WARKA_EMAIL_OUTBOX_ENABLED === 'true' &&
  process.env.WARKA_EMAIL_CONTROLLED_TEST === 'enabled'
const testEmailProvider = controlledEmail ? new FakeEmailProvider() : undefined
const schedulerConfig = schedulerConfiguration(process.env)
const schedulerDatabase = schedulerConfig.enabled
  ? createDatabaseClient()
  : undefined
const scheduler = schedulerDatabase
  ? new BackupScheduler(schedulerDatabase, schedulerConfig)
  : undefined
const scanConfig = fileScanSchedulerConfiguration(process.env)
const scanDatabase = scanConfig.enabled ? createDatabaseClient() : undefined
const scanScheduler = scanDatabase
  ? new FileScanScheduler(scanDatabase, scanConfig)
  : undefined
const emailConfig = emailOutboxConfiguration(process.env)
const emailDatabase = emailConfig.enabled ? createDatabaseClient() : undefined
const emailScheduler = emailDatabase
  ? new EmailOutboxScheduler(emailDatabase, emailConfig, testEmailProvider)
  : undefined
const app = buildApp({
  production: profile.secureCookies,
  ...(testEmailProvider ? { testEmailProvider } : {}),
  testEmailTick: () => emailScheduler?.tick() ?? Promise.resolve(),
})
const shutdown = createApplicationShutdown({
  stopWorkers: [scheduler, scanScheduler, emailScheduler],
  closeServer: () => app.close(),
  onTimeout: () => process.exit(1),
})
process.once('SIGTERM', () => void shutdown())
process.once('SIGINT', () => void shutdown())
app.addHook('onClose', async () => {
  await scheduler?.stop()
  await scanScheduler?.stop()
  await emailScheduler?.stop()
  await schedulerDatabase?.$disconnect()
  await scanDatabase?.$disconnect()
  await emailDatabase?.$disconnect()
})

try {
  await app.listen(serverConfig(process.env))
  app.log.info({ build: buildMetadata(process.env) }, 'Warka started')
  const reconciliationDatabase =
    schedulerDatabase ?? scanDatabase ?? emailDatabase
  if (reconciliationDatabase)
    await runStartupReconciliation(reconciliationDatabase)
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.WARKA_SCHEDULER_CONTROLLED_TEST === 'enabled'
  )
    schedulerHealth.configure(
      schedulerConfig.enabled,
      schedulerConfig.intervalMs,
    )
  else scheduler?.start(() => app.log.error('Backup scheduler poll failed'))
  scanScheduler?.start(() => app.log.error('File scan scheduler poll failed'))
  if (!controlledEmail)
    emailScheduler?.start(() => app.log.error('Email outbox poll failed'))
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
