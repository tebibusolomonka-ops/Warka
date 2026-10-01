import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

test('upgrade acceptance is upgrade-only and covers every fixture', () => {
  const result = JSON.parse(
    execFileSync(process.execPath, ['scripts/upgrade-acceptance.mjs'], {
      encoding: 'utf8',
    }),
  )
  assert.equal(result.schemaDirection, 'upgrade-only')
  assert.equal(result.fixtures.length, 4)
  assert.ok(result.fixtures.every((fixture) => fixture.invariants === 'passed'))
})
