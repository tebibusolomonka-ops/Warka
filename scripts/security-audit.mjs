import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function evaluateAudit(report, policy, today = new Date()) {
  const errors = []
  const exceptions = policy.exceptions ?? []
  for (const exception of exceptions) {
    for (const field of [
      'package',
      'advisory',
      'reason',
      'reviewContext',
      'expiresOn',
    ]) {
      if (!exception[field]) errors.push(`Exception is missing ${field}`)
    }
    if (
      exception.expiresOn &&
      new Date(`${exception.expiresOn}T23:59:59Z`) < today
    ) {
      errors.push(
        `Exception expired: ${exception.package} ${exception.advisory}`,
      )
    }
  }
  const high = Object.values(report.advisories ?? {}).filter((item) =>
    ['high', 'critical'].includes(item.severity),
  )
  for (const item of high) {
    const advisory = item.github_advisory_id ?? String(item.id)
    const accepted = exceptions.some(
      (entry) =>
        entry.package === item.module_name && entry.advisory === advisory,
    )
    if (!accepted)
      errors.push(`${item.severity}: ${item.module_name} ${advisory}`)
  }
  return { errors, highCount: high.length, exceptionCount: exceptions.length }
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const policy = JSON.parse(
    readFileSync(
      new URL('../security/dependency-audit-exceptions.json', import.meta.url),
    ),
  )
  let output
  try {
    output = execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['audit', '--prod', '--json'],
      { cwd: root, encoding: 'utf8' },
    )
  } catch (error) {
    output = error.stdout
    if (!output) throw error
  }
  const result = evaluateAudit(JSON.parse(output), policy)
  if (result.errors.length) {
    console.error(`Dependency audit failed:\n${result.errors.join('\n')}`)
    process.exitCode = 1
    return
  }
  console.log(
    `Dependency audit passed (${result.highCount} high/critical advisories covered by ${result.exceptionCount} time-limited exceptions).`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main()
