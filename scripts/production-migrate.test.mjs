import assert from 'node:assert/strict'
import test from 'node:test'
import { runProductionMigration } from './production-migrate.mjs'

test('runs preflight before deploy', () => {
  const previous = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test.invalid/warka'
  const calls = []
  runProductionMigration((_command, args) => calls.push(args.join(' ')))
  assert.deepEqual(calls, [
    'scripts/db-preflight.mjs --allow-pending',
    'db:deploy',
  ])
  if (previous === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = previous
})

test('stops when preflight fails', () => {
  const previous = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test.invalid/warka'
  const calls = []
  assert.throws(() =>
    runProductionMigration((_command, args) => {
      calls.push(args.join(' '))
      throw new Error('preflight failed')
    }),
  )
  assert.deepEqual(calls, ['scripts/db-preflight.mjs --allow-pending'])
  if (previous === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = previous
})
