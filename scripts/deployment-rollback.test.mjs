import assert from 'node:assert/strict'
import test from 'node:test'
import { executeRollback } from './deployment-rollback.mjs'

const manifest = (version, compatibility = 'none') => ({
  schemaVersion: 1,
  releaseVersion: version,
  revision: 'a'.repeat(40),
  images: { api: `api:${version}`, web: `web:${version}` },
  migrationCompatibility: compatibility,
  profile: 'singleHost',
})
test('dry rollback does not mutate infrastructure or reverse migrations', () => {
  let calls = 0
  const result = executeRollback(
    manifest('2.0.0'),
    manifest('1.0.0'),
    { dryRun: true },
    () => {
      calls += 1
    },
  )
  assert.equal(calls, 0)
  assert.ok(
    result.plan.every(([, args]) => !args.join(' ').includes('migrate')),
  )
})
test('refuses blocked rollback', () =>
  assert.throws(
    () =>
      executeRollback(manifest('2.0.0', 'incompatible'), manifest('1.0.0'), {
        dryRun: true,
      }),
    /blocked/,
  ))
