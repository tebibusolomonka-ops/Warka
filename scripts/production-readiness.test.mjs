import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateReadiness } from './production-readiness.mjs'

test('readiness reports explicit blockers and unavailable evidence without a score', () => {
  const result = evaluateReadiness({
    productionConfiguration: false,
    migrationState: true,
  })
  assert.equal(result.state, 'blocked')
  assert.equal(
    result.checks.find(({ id }) => id === 'productionConfiguration').state,
    'blocked',
  )
  assert.equal(
    result.checks.find(({ id }) => id === 'securityChecks').state,
    'notChecked',
  )
  assert.equal('score' in result, false)
})
