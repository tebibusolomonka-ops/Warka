import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const auditChecks = [
  ['ciPolicy', ['ci:check'], true],
  ['security', ['security:check'], true],
  ['localization', ['i18n:check'], true],
  ['containers', ['containers:check'], true],
  ['releaseVersion', ['release:check'], true],
  ['deploymentManifest', ['deployment:manifest:check'], true],
  ['acceptance', ['acceptance:check'], true],
  ['runbooks', ['runbooks:check'], true],
  ['readiness', ['readiness:check'], false],
  ['releaseCandidate', ['test:release-candidate'], true],
  ['domainInvariants', ['data:verify'], true],
  ['historicalUpgrade', ['test:upgrade-matrix'], true],
]

export function buildAuditResult(results) {
  const requiredBlocked = results.some(
    ({ required, state }) => required && state === 'blocked',
  )
  return {
    state: requiredBlocked
      ? 'blocked'
      : results.some(({ state }) => state === 'notChecked')
        ? 'warning'
        : 'ready',
    mutationMode: 'read-only',
    results,
  }
}

async function runAudit() {
  const results = []
  for (const [id, args, required] of auditChecks) {
    const result = spawnSync('pnpm', args, {
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    })
    results.push({
      id,
      required,
      state:
        result.status === 0 ? 'ready' : required ? 'blocked' : 'notChecked',
    })
    if (required && result.status !== 0) break
  }
  const audit = buildAuditResult(results)
  if (process.env.WARKA_RELEASE_AUDIT_OUTPUT) {
    await mkdir('.artifacts', { recursive: true })
    await writeFile(
      process.env.WARKA_RELEASE_AUDIT_OUTPUT,
      `${JSON.stringify(audit, null, 2)}\n`,
    )
  }
  console.log(JSON.stringify(audit))
  if (audit.state === 'blocked') process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runAudit()
