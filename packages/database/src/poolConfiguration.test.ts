import { describe, expect, it } from 'vitest'
import {
  applyDatabasePoolConfiguration,
  databasePoolConfiguration,
} from './poolConfiguration.js'

describe('database pool safeguards', () => {
  it('uses conservative production and smaller test defaults', () => {
    expect(databasePoolConfiguration({ NODE_ENV: 'production' })).toEqual({
      connectionLimit: 10,
      poolTimeoutSeconds: 10,
    })
    expect(
      databasePoolConfiguration({ NODE_ENV: 'test' }).connectionLimit,
    ).toBe(5)
  })

  it('validates bounded settings and applies them without returning credentials as metadata', () => {
    const config = databasePoolConfiguration({
      WARKA_DB_CONNECTION_LIMIT: '12',
      WARKA_DB_POOL_TIMEOUT_SECONDS: '15',
    })
    const applied = new URL(
      applyDatabasePoolConfiguration(
        'postgresql://user:private@example.test/warka?schema=public',
        config,
      ),
    )
    expect(applied.searchParams.get('connection_limit')).toBe('12')
    expect(applied.searchParams.get('pool_timeout')).toBe('15')
    expect(config).toEqual({ connectionLimit: 12, poolTimeoutSeconds: 15 })
    expect(JSON.stringify(config)).not.toContain('private')
    expect(() =>
      databasePoolConfiguration({ WARKA_DB_CONNECTION_LIMIT: '500' }),
    ).toThrow('Invalid database connection limit')
  })
})
