export type DatabasePoolConfiguration = {
  connectionLimit: number
  poolTimeoutSeconds: number
}

export function databasePoolConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): DatabasePoolConfiguration {
  const test = env.NODE_ENV === 'test'
  const connectionLimit = Number(
    env.WARKA_DB_CONNECTION_LIMIT ?? (test ? 5 : 10),
  )
  const poolTimeoutSeconds = Number(env.WARKA_DB_POOL_TIMEOUT_SECONDS ?? 10)
  if (
    !Number.isInteger(connectionLimit) ||
    connectionLimit < 1 ||
    connectionLimit > 50
  )
    throw new Error('Invalid database connection limit')
  if (
    !Number.isInteger(poolTimeoutSeconds) ||
    poolTimeoutSeconds < 1 ||
    poolTimeoutSeconds > 60
  )
    throw new Error('Invalid database pool timeout')
  return { connectionLimit, poolTimeoutSeconds }
}

export function applyDatabasePoolConfiguration(
  databaseUrl: string,
  config: DatabasePoolConfiguration,
) {
  const url = new URL(databaseUrl)
  url.searchParams.set('connection_limit', String(config.connectionLimit))
  url.searchParams.set('pool_timeout', String(config.poolTimeoutSeconds))
  return url.toString()
}
