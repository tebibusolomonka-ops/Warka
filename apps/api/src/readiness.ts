import { access, constants } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@warka/database'

export type DependencyState = 'ready' | 'unavailable'
export type Readiness = {
  status: 'ready' | 'unavailable'
  dependencies: {
    database: DependencyState
    documentRenderer: DependencyState
    backupStorage: DependencyState
  }
}

export async function checkReadiness(input: {
  database: PrismaClient
  env?: NodeJS.ProcessEnv
  checkPath?: (path: string) => Promise<void>
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
  return {
    status: Object.values(dependencies).every((state) => state === 'ready')
      ? 'ready'
      : 'unavailable',
    dependencies,
  }
}
