import assert from 'node:assert/strict'
import test from 'node:test'
import { validateInstallPolicy } from './reproducible-install.mjs'

const valid = {
  manifest: { packageManager: 'pnpm@11.25.0' },
  nodeVersion: '24.11.1',
  lockfile: "lockfileVersion: '9.0'\n",
  workflow: 'pnpm install --frozen-lockfile',
}

test('accepts exact tool versions and frozen CI installation', () => {
  assert.deepEqual(validateInstallPolicy(valid), [])
})

test('rejects floating package managers and mutable CI installs', () => {
  const errors = validateInstallPolicy({
    ...valid,
    manifest: { packageManager: 'pnpm@latest' },
    workflow: 'pnpm install',
  })
  assert.equal(errors.length, 2)
})
