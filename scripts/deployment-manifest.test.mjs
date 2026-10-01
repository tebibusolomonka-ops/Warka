import assert from 'node:assert/strict'
import test from 'node:test'
import { validateDeploymentManifest } from './deployment-manifest.mjs'

const valid = {
  schemaVersion: 1,
  releaseVersion: '1.2.3',
  revision: 'a'.repeat(40),
  images: { api: 'api:1.2.3', web: 'web:1.2.3' },
  migrationCompatibility: 'additive',
  profile: 'singleHost',
}
test('accepts a consistent manifest', () =>
  assert.equal(validateDeploymentManifest(valid).releaseVersion, '1.2.3'))
test('rejects mixed image releases', () =>
  assert.throws(
    () =>
      validateDeploymentManifest({
        ...valid,
        images: { ...valid.images, web: 'web:2.0.0' },
      }),
    /web image/,
  ))
