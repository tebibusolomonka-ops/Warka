import assert from 'node:assert/strict'
import test from 'node:test'
import { validateSbom } from './security-sbom.mjs'

test('accepts a CycloneDX document with identified components', () => {
  assert.deepEqual(
    validateSbom({
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      components: [{ name: 'warka', version: '0.1.0' }],
    }),
    [],
  )
})

test('rejects malformed or empty documents', () => {
  assert.equal(validateSbom({ bomFormat: 'other', components: [] }).length, 3)
})
