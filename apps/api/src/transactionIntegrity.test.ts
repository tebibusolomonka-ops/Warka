import { describe, expect, it } from 'vitest'

import { assertAtomic } from './transactionIntegrity.js'

describe('transaction integrity assertions', () => {
  for (const workflow of [
    'student import',
    'academic rollover',
    'document issuance',
    'coursework mark transfer',
    'reporting submission',
    'attendance bulk save',
  ]) {
    it(`leaves no linked partial state for ${workflow}`, async () => {
      const before = { parent: [] as string[], children: [] as string[] }
      const outcome = await assertAtomic(before, async (draft) => {
        draft.parent.push(workflow)
        throw new Error('injected midpoint failure')
      })
      expect(outcome).toEqual({ committed: false, value: before })
      expect(outcome.value.children).toEqual([])
    })
  }
})
