import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateRollbackReadiness } from './rollback-readiness.mjs'

const release = { profile: 'singleHost', migrationCompatibility: 'none' }
test('allows application-only rollback', () =>
  assert.equal(evaluateRollbackReadiness(release, release).status, 'eligible'))
test('requires review for additive migrations', () =>
  assert.equal(
    evaluateRollbackReadiness(
      { ...release, migrationCompatibility: 'additive' },
      release,
    ).status,
    'requiresReview',
  ))
test('blocks incompatible schema rollback', () =>
  assert.equal(
    evaluateRollbackReadiness(
      { ...release, migrationCompatibility: 'incompatible' },
      release,
    ).status,
    'blocked',
  ))
