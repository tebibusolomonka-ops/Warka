import assert from 'node:assert/strict'
import test from 'node:test'
import { planRecoveryDrill } from './recovery-drill.mjs'

test('recovery drill refuses production and requires explicit acknowledgement', () => {
  assert.throws(() =>
    planRecoveryDrill('production', 'I_ACKNOWLEDGE_ISOLATED_DRILL'),
  )
  assert.throws(() => planRecoveryDrill('drill'))
})

test('recovery drill plans isolated factual validation', () => {
  const result = planRecoveryDrill('drill', 'I_ACKNOWLEDGE_ISOLATED_DRILL')
  assert.equal(result.productionMutation, false)
  assert.ok(result.steps.includes('verifyInvariants'))
})
