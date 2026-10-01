import assert from 'node:assert/strict'
import test from 'node:test'
import { checkRunbooks } from './runbooks-check.mjs'

test('runbooks contain required safety sections and repository commands', async () => {
  const result = await checkRunbooks()
  assert.equal(result.ok, true)
  assert.equal(result.results.length, 9)
})
