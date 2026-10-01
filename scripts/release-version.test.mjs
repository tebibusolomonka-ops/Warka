import assert from 'node:assert/strict'
import test from 'node:test'
import {
  readReleaseVersion,
  validateReleaseVersion,
} from './release-version.mjs'

test('reads the repository semantic version', async () =>
  assert.equal(await readReleaseVersion(), '0.1.0'))
test('rejects invalid release versions', () =>
  assert.throws(() => validateReleaseVersion('latest')))
