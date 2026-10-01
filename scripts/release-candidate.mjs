import { spawnSync } from 'node:child_process'

const pnpm = 'pnpm'
const apiTests = [
  'src/faultInjection.test.ts',
  'src/databaseOutageScenarios.test.ts',
  'src/storageOutageScenarios.test.ts',
  'src/providerOutageScenarios.test.ts',
  'src/workerCrashScenarios.test.ts',
  'src/transactionIntegrity.test.ts',
  'src/domainInvariants.test.ts',
  'src/restoreValidation.test.ts',
  'src/releaseCandidateProfile.test.ts',
  'src/acceptanceFixture.test.ts',
  'src/identityLifecycle.acceptance.test.ts',
  'src/academicLifecycle.acceptance.test.ts',
  'src/courseworkLifecycle.acceptance.test.ts',
  'src/documentLifecycle.acceptance.test.ts',
  'src/reportingLifecycle.acceptance.test.ts',
  'src/recoveryLifecycle.acceptance.test.ts',
]

const checks = [
  ['--filter', '@warka/api', 'exec', 'vitest', 'run', ...apiTests],
  ['test:upgrade-matrix'],
  ['data:verify'],
  ['ci:check'],
  ['i18n:check'],
  ['containers:check'],
  ['test:load:config'],
]
if (process.env.WARKA_RC_SKIP_SECURITY !== '1')
  checks.splice(4, 0, ['security:check'])
if (process.env.DATABASE_URL) checks.push(['db:preflight'])
if (process.env.WARKA_RC_SKIP_BROWSER !== '1')
  checks.push(['exec', 'playwright', 'test'])

for (const args of checks) {
  const result = spawnSync(pnpm, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
