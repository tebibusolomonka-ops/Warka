import assert from 'node:assert/strict'
import test from 'node:test'
import { findSecretPatterns } from './secret-scan.mjs'

test('recognizes credential formats without matching ordinary configuration', () => {
  assert.equal(
    findSecretPatterns('DATABASE_URL=postgresql://localhost/warka').length,
    0,
  )
  assert.equal(findSecretPatterns('-----BEGIN PRIVATE KEY-----').length, 1)
})
