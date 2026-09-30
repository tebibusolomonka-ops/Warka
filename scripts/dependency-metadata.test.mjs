import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateMetadata } from './dependency-metadata.mjs'

test('rejects undocumented missing license metadata', () => {
  const result = evaluateMetadata(
    [{ name: 'unknown', version: '1.0.0', license: null }],
    { exceptions: [] },
  )
  assert.match(result.errors[0], /unknown@1.0.0/)
})

test('reports a documented metadata gap honestly', () => {
  const policy = {
    exceptions: [
      {
        package: 'buffers',
        reason: 'Upstream gap',
        reviewContext: 'On upgrade',
      },
    ],
  }
  const result = evaluateMetadata(
    [{ name: 'buffers', version: '0.1.1', license: null }],
    policy,
  )
  assert.equal(result.errors.length, 0)
  assert.equal(result.warnings[0].documented, true)
})
