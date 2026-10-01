import assert from 'node:assert/strict'
import test from 'node:test'
import {
  forbiddenContextInputs,
  requiredBuildInputs,
  validateContainerContext,
} from './container-context-check.mjs'

test('defines build inputs without secret files', () => {
  assert.ok(requiredBuildInputs.includes('tsconfig.base.json'))
  assert.ok(
    requiredBuildInputs.includes('packages/database/prisma/schema.prisma'),
  )
  assert.ok(!requiredBuildInputs.some((path) => path.includes('.env')))
  assert.ok(forbiddenContextInputs.includes('knowledge'))
})

test('validates the repository container context', async () => {
  await assert.doesNotReject(validateContainerContext())
})
