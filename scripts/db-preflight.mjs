import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const databaseDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/database',
)
const prismaCli = resolve(
  databaseDirectory,
  'node_modules/prisma/build/index.js',
)

export function classifyMigrationStatus(code, output) {
  if (code === 0 && /Database schema is up to date/i.test(output))
    return 'ready'
  if (
    /Following migration.*have not yet been applied|migrations? have not yet been applied/i.test(
      output,
    )
  )
    return 'pending'
  if (/failed migration/i.test(output)) return 'failedMigration'
  if (/diverg|not found in the local migrations directory/i.test(output))
    return 'diverged'
  return 'unavailable'
}

export function redactDatabaseOutput(output, databaseUrl = '') {
  let safe = databaseUrl
    ? output.replaceAll(databaseUrl, '[DATABASE_URL]')
    : output
  safe = safe.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL]')
  return safe
}

function run(args, env = process.env) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: databaseDirectory,
    env,
    encoding: 'utf8',
  })
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const validation = run(['validate'], {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://localhost:5432/warka',
  })
  if (validation.status !== 0) {
    process.stdout.write('Migration preflight: schemaValidationFailed\n')
    process.exitCode = 1
  } else if (!process.env.DATABASE_URL) {
    process.stdout.write(
      'Migration preflight: databaseUnavailable (DATABASE_URL)\n',
    )
    process.exitCode = 1
  } else {
    const status = run(['migrate', 'status'])
    const result = classifyMigrationStatus(
      status.status,
      `${status.stdout ?? ''}\n${status.stderr ?? ''}`,
    )
    process.stdout.write(`Migration preflight: ${result}\n`)
    if (
      result !== 'ready' &&
      !(process.argv.includes('--allow-pending') && result === 'pending')
    )
      process.exitCode = 1
  }
}
