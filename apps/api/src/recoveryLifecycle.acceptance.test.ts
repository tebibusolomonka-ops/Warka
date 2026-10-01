import { describe, expect, it } from 'vitest'

import { validateRestore } from './restoreValidation.js'
import { reconcileInterrupted } from './workerRecovery.js'

describe('operational recovery lifecycle acceptance', () => {
  it('requires isolated restore and factual recovery evidence', () => {
    expect(
      validateRestore({
        isolatedTarget: true,
        restoreExitCode: 0,
        migrationsCurrent: true,
        coreTablesReadable: true,
        invariantViolations: 0,
        checksumsMatch: true,
      }),
    ).toEqual({ restoreCompleted: true, integrityPassed: true, failures: [] })
  })

  it('retries safe expired work and reviews ambiguous effects', () => {
    expect(
      reconcileInterrupted({ state: 'RUNNING', leaseUntil: 1 }, 2),
    ).toEqual({
      state: 'PENDING',
    })
    expect(
      reconcileInterrupted(
        { state: 'RUNNING', leaseUntil: 1, externalEffectPossible: true },
        2,
      ),
    ).toEqual({ state: 'REVIEW' })
  })

  it('does not mark interrupted work completed', () => {
    expect(
      reconcileInterrupted({ state: 'RUNNING', leaseUntil: 1 }, 2).state,
    ).not.toBe('COMPLETED')
  })
})
