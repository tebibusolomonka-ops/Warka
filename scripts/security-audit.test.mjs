import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateAudit } from './security-audit.mjs'

const finding = {
  id: 1,
  github_advisory_id: 'GHSA-test',
  module_name: 'sample',
  severity: 'high',
}

test('rejects undocumented high vulnerabilities', () => {
  const result = evaluateAudit(
    { advisories: { 1: finding } },
    { exceptions: [] },
  )
  assert.match(result.errors[0], /sample/)
})

test('accepts an exact current exception', () => {
  const policy = {
    exceptions: [
      {
        package: 'sample',
        advisory: 'GHSA-test',
        reason: 'Scoped',
        reviewContext: 'Upgrade',
        expiresOn: '2027-01-01',
      },
    ],
  }
  assert.deepEqual(
    evaluateAudit(
      { advisories: { 1: finding } },
      policy,
      new Date('2026-01-01'),
    ).errors,
    [],
  )
})

test('rejects expired exceptions', () => {
  const policy = {
    exceptions: [
      {
        package: 'sample',
        advisory: 'GHSA-test',
        reason: 'Scoped',
        reviewContext: 'Upgrade',
        expiresOn: '2025-01-01',
      },
    ],
  }
  assert.match(
    evaluateAudit({ advisories: {} }, policy, new Date('2026-01-01')).errors[0],
    /expired/,
  )
})
