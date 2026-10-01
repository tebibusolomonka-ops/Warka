import assert from 'node:assert/strict'
import test from 'node:test'
import { checkAcceptance } from './acceptance-check.mjs'

test('acceptance matrix preserves explicit coverage states and evidence', async () => {
  const result = await checkAcceptance()
  assert.equal(result.ok, true)
  assert.equal(
    result.capabilities.find(({ id }) => id === 'accessibility').state,
    'partial',
  )
  assert.equal('percentage' in result, false)
})
