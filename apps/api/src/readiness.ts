import { access, constants } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@warka/database'
import { schedulerHealth } from './schedulerHealth.js'
import { configuredFileScanner } from './fileScannerConfig.js'
import type { ScannerHealth } from './fileScanner.js'
import { configuredEmailProvider } from './emailOutboxScheduler.js'
import type { EmailProviderHealth } from './emailProvider.js'

export type DependencyState = 'ready' | 'unavailable'
export type Readiness = {
  status: 'ready' | 'degraded' | 'unavailable'
  dependencies: {
    database: DependencyState
    documentRenderer: DependencyState
    backupStorage: DependencyState
  }
  scheduler?: Awaited<ReturnType<typeof schedulerHealth.snapshot>>
  scanner?: ScannerHealth
  email: EmailProviderHealth | 'disabled'
}

export async function checkReadiness(input: {
  database: PrismaClient
  env?: NodeJS.ProcessEnv
  checkPath?: (path: string) => Promise<void>
  checkScanner?: () => Promise<ScannerHealth>
  checkEmail?: () => Promise<EmailProviderHealth>
}): Promise<Readiness> {
  const env = input.env ?? process.env
  const checkPath =
    input.checkPath ??
    ((path: string) => access(path, constants.R_OK | constants.W_OK))
  const dependencies: Readiness['dependencies'] = {
    database: 'unavailable',
    documentRenderer: 'unavailable',
    backupStorage: 'unavailable',
  }
  try {
    await input.database.$queryRaw`SELECT 1`
    dependencies.database = 'ready'
  } catch {
    dependencies.database = 'unavailable'
  }
  try {
    const base = new URL(env.PUBLIC_BASE_URL ?? '')
    if (!['http:', 'https:'].includes(base.protocol))
      throw new Error('Invalid document base URL')
    await checkPath(
      fileURLToPath(new URL('../assets/NotoSansEthiopic.ttf', import.meta.url)),
    )
    dependencies.documentRenderer = 'ready'
  } catch {
    dependencies.documentRenderer = 'unavailable'
  }
  if (env.BACKUP_STORAGE_DIR) {
    try {
      await checkPath(env.BACKUP_STORAGE_DIR)
      dependencies.backupStorage = 'ready'
    } catch {
      dependencies.backupStorage = 'unavailable'
    }
  }
  const schedulerEnabled =
    env.WARKA_BACKUP_SCHEDULER_ENABLED === 'true' ||
    env.WARKA_RETENTION_EVALUATION_ENABLED === 'true'
  const scheduler = schedulerEnabled
    ? await schedulerHealth.snapshot(input.database)
    : undefined
  let scanner: ScannerHealth | undefined
  if (env.WARKA_FILE_SCAN_SCHEDULER_ENABLED === 'true') {
    try {
      scanner = await (
        input.checkScanner ?? (() => configuredFileScanner(env).health())
      )()
    } catch {
      scanner = 'unavailable'
    }
  }
  let email: Readiness['email'] = 'disabled'
  if (env.WARKA_EMAIL_OUTBOX_ENABLED === 'true') {
    try {
      email = await (
        input.checkEmail ?? (() => configuredEmailProvider(env).health())
      )()
    } catch {
      email = 'unavailable'
    }
  }
  const status = Object.values(dependencies).every((state) => state === 'ready')
    ? scheduler?.status === 'degraded' ||
      (scanner !== undefined && scanner !== 'available') ||
      (email !== 'disabled' && email !== 'available')
      ? 'degraded'
      : 'ready'
    : 'unavailable'
  return {
    status,
    dependencies,
    ...(scheduler ? { scheduler } : {}),
    ...(scanner ? { scanner } : {}),
    email,
  }
}
