import { serverConfig } from './config.js'
import { objectStorageConfiguration } from './objectFileStorage.js'
import { clamAvConfiguration } from './clamAvScanner.js'
import { smtpConfiguration } from './smtpEmailProvider.js'
import { schedulerConfiguration } from './backupScheduler.js'
import { emailOutboxConfiguration } from './emailOutboxScheduler.js'
import { environmentProfile } from './environmentProfile.js'
import { trustedOrigins } from './originPolicy.js'
import { trustedProxyConfiguration } from './proxyTrust.js'

export type ConfigurationIssue = {
  category: 'requiredCore' | 'requiredWhenEnabled'
  names: string[]
}

export function validateProductionConfiguration(
  env: NodeJS.ProcessEnv,
): ConfigurationIssue[] {
  if (environmentProfile(env).name !== 'production') return []
  const issues: ConfigurationIssue[] = []
  const requireValue = (
    category: ConfigurationIssue['category'],
    names: string[],
    valid: () => boolean,
  ) => {
    try {
      if (valid()) return
    } catch {
      issues.push({ category, names })
      return
    }
    issues.push({ category, names })
  }
  requireValue('requiredCore', ['DATABASE_URL'], () => {
    const url = new URL(env.DATABASE_URL ?? '')
    return ['postgresql:', 'postgres:'].includes(url.protocol)
  })
  requireValue('requiredCore', ['PUBLIC_BASE_URL'], () => {
    const url = new URL(env.PUBLIC_BASE_URL ?? '')
    return url.protocol === 'https:' && !url.username && !url.password
  })
  requireValue('requiredCore', ['WARKA_ALLOWED_ORIGINS'], () => {
    trustedOrigins(env)
    return true
  })
  requireValue('requiredCore', ['PORT'], () => !!serverConfig(env))
  requireValue('requiredCore', ['WARKA_TRUSTED_PROXIES'], () => {
    trustedProxyConfiguration(env)
    return true
  })
  requireValue(
    'requiredCore',
    ['FILE_STORAGE_BACKEND'],
    () => env.FILE_STORAGE_BACKEND === 's3',
  )
  if (env.FILE_STORAGE_BACKEND === 's3')
    requireValue(
      'requiredWhenEnabled',
      [
        'FILE_STORAGE_BUCKET',
        'FILE_STORAGE_REGION',
        'FILE_STORAGE_ENDPOINT',
        'FILE_STORAGE_ACCESS_KEY_ID',
        'FILE_STORAGE_SECRET_ACCESS_KEY',
      ],
      () => {
        objectStorageConfiguration(env).client.destroy()
        return true
      },
    )
  if (env.FILE_STORAGE_BACKEND === 'local')
    requireValue('requiredWhenEnabled', ['FILE_STORAGE_DIR'], () =>
      Boolean(env.FILE_STORAGE_DIR),
    )
  if (env.WARKA_FILE_SCAN_SCHEDULER_ENABLED === 'true')
    requireValue(
      'requiredWhenEnabled',
      ['FILE_SCANNER_BACKEND', 'CLAMAV_HOST', 'CLAMAV_PORT'],
      () => {
        if (env.FILE_SCANNER_BACKEND === 'test') return false
        clamAvConfiguration(env)
        return true
      },
    )
  if (env.WARKA_EMAIL_OUTBOX_ENABLED === 'true') {
    requireValue(
      'requiredWhenEnabled',
      ['WARKA_RECOVERY_TOKEN_KEY', 'WARKA_PUBLIC_APP_URL'],
      () => !!emailOutboxConfiguration(env),
    )
    requireValue(
      'requiredWhenEnabled',
      [
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'SMTP_FROM_ADDRESS',
        'SMTP_FROM_NAME',
      ],
      () => !!smtpConfiguration(env),
    )
  }
  if (
    env.WARKA_BACKUP_SCHEDULER_ENABLED === 'true' ||
    env.WARKA_RETENTION_EVALUATION_ENABLED === 'true'
  )
    requireValue(
      'requiredWhenEnabled',
      ['WARKA_SCHEDULER_ACTOR_ID', 'BACKUP_STORAGE_DIR'],
      () => !!schedulerConfiguration(env),
    )
  return issues
}

export function assertProductionConfiguration(env: NodeJS.ProcessEnv) {
  const issues = validateProductionConfiguration(env)
  if (issues.length)
    throw new Error(
      `Invalid production configuration: ${issues.flatMap((issue) => issue.names).join(', ')}`,
    )
}
