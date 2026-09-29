import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@warka/database'

const migrationsDirectory = fileURLToPath(
  new URL('../../../packages/database/prisma/migrations/', import.meta.url),
)

export function classifyMigrationHistory(
  localNames: string[],
  rows: Array<{
    migration_name: string
    finished_at: Date | null
    rolled_back_at: Date | null
  }>,
): 'ready' | 'pending' | 'failed' {
  if (rows.some((row) => !row.finished_at && !row.rolled_back_at))
    return 'failed'
  const applied = new Set(
    rows.filter((row) => row.finished_at).map((row) => row.migration_name),
  )
  if ([...applied].some((name) => !localNames.includes(name))) return 'failed'
  if (localNames.some((name) => !applied.has(name))) return 'pending'
  return 'ready'
}

export async function checkMigrationReadiness(
  database: Pick<PrismaClient, '$queryRaw'>,
): Promise<'ready' | 'pending' | 'failed' | 'unavailable'> {
  try {
    const localNames = (
      await readdir(migrationsDirectory, { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    const rows = await database.$queryRaw<
      Array<{
        migration_name: string
        finished_at: Date | null
        rolled_back_at: Date | null
      }>
    >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`
    return classifyMigrationHistory(localNames, rows)
  } catch {
    return 'unavailable'
  }
}
