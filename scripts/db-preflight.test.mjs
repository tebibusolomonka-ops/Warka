import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyMigrationStatus,
  redactDatabaseOutput,
} from './db-preflight.mjs'

test('migration status classifies Prisma diagnostics', () => {
  assert.equal(
    classifyMigrationStatus(0, 'Database schema is up to date!'),
    'ready',
  )
  assert.equal(
    classifyMigrationStatus(
      1,
      'The following migrations have not yet been applied',
    ),
    'pending',
  )
  assert.equal(
    classifyMigrationStatus(1, 'failed migration detected'),
    'failedMigration',
  )
  assert.equal(
    classifyMigrationStatus(1, 'migration history diverges'),
    'diverged',
  )
  assert.equal(
    classifyMigrationStatus(1, 'P1001 Cannot reach database'),
    'unavailable',
  )
})

test('diagnostic output redacts database URLs', () => {
  assert.equal(
    redactDatabaseOutput('postgresql://user:secret@localhost:5432/warka'),
    '[DATABASE_URL]',
  )
})
