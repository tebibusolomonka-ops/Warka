import assert from 'node:assert/strict'
import test from 'node:test'
import { executeRollout } from './deployment-rollout.mjs'

const manifest = {
  schemaVersion: 1,
  releaseVersion: '1.0.0',
  revision: 'a'.repeat(40),
  images: { api: 'api:1.0.0', web: 'web:1.0.0' },
  migrationCompatibility: 'additive',
  profile: 'singleHost',
}
test('dry run performs no infrastructure mutation', () => {
  let calls = 0
  const plan = executeRollout(manifest, { dryRun: true }, () => {
    calls += 1
  })
  assert.equal(calls, 0)
  assert.equal(plan.length, 5)
})
test('requires exact environment acknowledgement', () =>
  assert.throws(
    () =>
      executeRollout(manifest, {
        environment: 'production',
        acknowledgement: 'staging',
      }),
    /acknowledgement/,
  ))
