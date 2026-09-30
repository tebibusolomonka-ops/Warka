import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCiWorkflow } from './ci-check.mjs'

const commands = [
  'pnpm install --frozen-lockfile',
  'pnpm db:deploy',
  'pnpm lint',
  'pnpm format:check',
  'pnpm i18n:check',
  'pnpm typecheck',
  'pnpm test',
  'pnpm build',
  'pnpm exec playwright test',
]
const valid = `
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
${commands.map((command) => `      - run: ${command}`).join('\n')}
`

test('accepts required main and pull request validation coverage', () => {
  assert.deepEqual(validateCiWorkflow(valid), [])
})

test('rejects missing main coverage and validation commands', () => {
  const errors = validateCiWorkflow(
    valid
      .replace('branches: [main]', 'branches: [develop]')
      .replace('      - run: pnpm test\n', ''),
  )
  assert.ok(errors.includes('CI must run for pushes to main'))
  assert.ok(errors.includes('CI validation command is missing: pnpm test'))
})

test('rejects malformed or duplicate workflow keys', () => {
  assert.ok(validateCiWorkflow('name: CI\nname: duplicate').length > 0)
})

test('rejects floating workflow action tags', () => {
  const errors = validateCiWorkflow(
    valid.replace(
      'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
      'actions/checkout@v4',
    ),
  )
  assert.ok(
    errors.includes(
      'Workflow action must use an immutable commit SHA: actions/checkout@v4',
    ),
  )
})
