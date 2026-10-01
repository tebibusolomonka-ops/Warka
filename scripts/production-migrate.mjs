import { spawnSync } from 'node:child_process'

export function runMigrationStep(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Migration step failed with exit code ${result.status}`)
}

export function runProductionMigration(run = runMigrationStep) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  run(process.execPath, ['scripts/db-preflight.mjs', '--allow-pending'])
  run(pnpm, ['db:deploy'])
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  try {
    runProductionMigration()
  } catch (error) {
    process.stderr.write(
      `Production migration failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    )
    process.exitCode = 1
  }
}
