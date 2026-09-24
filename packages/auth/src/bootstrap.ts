import { createDatabaseClient } from '@warka/database'
import { BootstrapConflictError, bootstrapOwner } from './bootstrapOwner.js'

function option(args: string[], name: string): string {
  const index = args.indexOf(`--${name}`)
  const value = args[index + 1]
  if (index < 0 || !value || value.startsWith('--')) {
    throw new Error(`Missing --${name}`)
  }
  return value
}

try {
  const args = process.argv.slice(2).filter((value) => value !== '--')
  const password = process.env.WARKA_OWNER_PASSWORD
  if (!password) {
    throw new Error('WARKA_OWNER_PASSWORD is required')
  }

  const input = {
    email: option(args, 'email'),
    displayName: option(args, 'display-name'),
    organizationName: option(args, 'organization'),
    password,
  }
  const database = createDatabaseClient()
  try {
    const { user, organization } = await bootstrapOwner(database, input)
    process.stdout.write(
      `Created owner ${user.id} for organization ${organization.id}\n`,
    )
  } finally {
    await database.$disconnect()
  }
} catch (error) {
  const message =
    error instanceof BootstrapConflictError ||
    (error instanceof Error &&
      (error.message.startsWith('Missing --') ||
        error.message === 'WARKA_OWNER_PASSWORD is required' ||
        error.message.startsWith('DATABASE_URL must')))
      ? error.message
      : 'Owner bootstrap failed'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
