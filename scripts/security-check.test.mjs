import assert from 'node:assert/strict'
import test from 'node:test'
import { SECURITY_COMMANDS } from './security-check.mjs'

test('composes each repository security policy once', () => {
  assert.equal(new Set(SECURITY_COMMANDS).size, SECURITY_COMMANDS.length)
  for (const required of [
    'ci:check',
    'security:audit',
    'security:dependencies',
    'security:sbom',
  ])
    assert.ok(SECURITY_COMMANDS.includes(required))
})
