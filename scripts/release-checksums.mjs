import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function filesUnder(path) {
  if (!statSync(path, { throwIfNoEntry: false })) return []
  return readdirSync(path, { recursive: true })
    .map((name) => resolve(path, name))
    .filter((name) => statSync(name).isFile())
}

export function artifactChecksums(root, paths) {
  return paths
    .flatMap(filesUnder)
    .map((path) => ({
      name: relative(root, path).replaceAll('\\', '/'),
      algorithm: 'SHA-256',
      checksum: createHash('sha256').update(readFileSync(path)).digest('hex'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8'),
  )
  const paths = [
    'apps/web/dist',
    'apps/api/dist',
    'packages/database/dist',
    'packages/database/prisma/migrations',
  ].map((path) => resolve(root, path))
  const artifacts = artifactChecksums(root, paths)
  if (!artifacts.length)
    throw new Error('No built or migration artifacts were found')
  const document = {
    schemaVersion: 1,
    application: manifest.name,
    version: manifest.version,
    gitCommit: git(root, 'rev-parse', 'HEAD'),
    buildTimestamp: process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : git(root, 'show', '-s', '--format=%cI', 'HEAD'),
    integritySemantics:
      'SHA-256 checksums detect artifact changes; they are not digital signatures.',
    artifacts,
  }
  const json = `${JSON.stringify(document, null, 2)}\n`
  const outputArg = process.argv.indexOf('--output')
  if (outputArg >= 0)
    writeFileSync(resolve(root, process.argv[outputArg + 1]), json)
  else if (!process.argv.includes('--verify')) process.stdout.write(json)
  console.error(
    `Release checksum manifest validated (${artifacts.length} files).`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main()
