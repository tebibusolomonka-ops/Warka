import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SECURITY_COMMANDS = [
  'ci:check',
  'install:check',
  'security:secrets',
  'security:audit',
  'security:dependencies',
  'security:sbom',
  'release:checksums -- --verify',
]

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  for (const command of SECURITY_COMMANDS) {
    console.log(`\n> pnpm ${command}`)
    const result = spawnSync(`pnpm ${command}`, {
      cwd: root,
      env: process.env,
      shell: true,
      stdio: 'inherit',
    })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  console.log('\nSecurity verification passed.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main()
