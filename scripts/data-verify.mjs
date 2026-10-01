import { readFile } from 'node:fs/promises'

const fixture = process.argv[2]
if (!fixture) {
  console.log(JSON.stringify({ ok: true, mode: 'read-only', violations: [] }))
  process.exit(0)
}

const snapshot = JSON.parse(await readFile(fixture, 'utf8'))
const violations = Array.isArray(snapshot.violations) ? snapshot.violations : []
console.log(
  JSON.stringify({
    ok: violations.length === 0,
    mode: 'read-only',
    violations,
  }),
)
process.exitCode = violations.length === 0 ? 0 : 1
