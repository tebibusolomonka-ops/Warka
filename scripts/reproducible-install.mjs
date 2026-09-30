import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateInstallPolicy({
  manifest,
  nodeVersion,
  lockfile,
  workflow,
}) {
  const errors = []
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(manifest.packageManager ?? ''))
    errors.push('packageManager must pin an exact pnpm version')
  if (!/^\d+\.\d+\.\d+$/.test(nodeVersion.trim()))
    errors.push('.node-version must pin an exact Node.js version')
  if (!lockfile.startsWith("lockfileVersion: '9.0'"))
    errors.push('Expected pnpm lockfile version 9.0')
  if (!workflow.includes('pnpm install --frozen-lockfile'))
    errors.push('CI must use frozen lockfile installation')
  return errors
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const read = (path) => readFileSync(resolve(root, path), 'utf8')
  const errors = validateInstallPolicy({
    manifest: JSON.parse(read('package.json')),
    nodeVersion: read('.node-version'),
    lockfile: read('pnpm-lock.yaml'),
    workflow: read('.github/workflows/ci.yml'),
  })
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('Reproducible install policy is valid.')
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
