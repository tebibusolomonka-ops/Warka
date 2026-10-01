import assert from 'node:assert/strict'
import test from 'node:test'
import { auditChecks, buildAuditResult } from './release-audit.mjs'

test('release audit blocks required failure and distinguishes unavailable optional evidence', () => {
  assert.equal(
    buildAuditResult([{ id: 'security', required: true, state: 'blocked' }])
      .state,
    'blocked',
  )
  assert.equal(
    buildAuditResult([
      { id: 'readiness', required: false, state: 'notChecked' },
    ]).state,
    'warning',
  )
  assert.equal(buildAuditResult([]).mutationMode, 'read-only')
  assert.ok(auditChecks.some(([id]) => id === 'releaseCandidate'))
})
