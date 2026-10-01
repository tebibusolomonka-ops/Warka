import { describe, expect, it } from 'vitest'

import { validateRestore } from './restoreValidation.js'

describe('backup restore validation', () => {
  const valid = {
    isolatedTarget: true,
    restoreExitCode: 0,
    migrationsCurrent: true,
    coreTablesReadable: true,
    invariantViolations: 0,
    checksumsMatch: true,
  }

  it('requires integrity evidence beyond a successful restore process', () => {
    expect(validateRestore({ ...valid, invariantViolations: 1 })).toEqual({
      restoreCompleted: true,
      integrityPassed: false,
      failures: ['DOMAIN_INVARIANTS_FAILED'],
    })
  })

  it('rejects a non-isolated restore target', () => {
    expect(
      validateRestore({ ...valid, isolatedTarget: false }).integrityPassed,
    ).toBe(false)
  })
})
