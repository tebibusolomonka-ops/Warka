import { execFileSync, spawnSync } from 'node:child_process'

const requested = process.argv[2] ?? 'HEAD'
if (process.argv.length > 3) {
  throw new Error('Usage: pnpm metrics:code [git-revision]')
}
const revision = execFileSync(
  'git',
  ['rev-parse', '--verify', `${requested}^{commit}`],
  {
    encoding: 'utf8',
  },
).trim()
const tree = execFileSync('git', ['ls-tree', '-r', '-z', revision], {
  encoding: 'buffer',
  maxBuffer: 32 * 1024 * 1024,
})
const allowed = /\.(?:ts|tsx|js|jsx|mjs|cjs|css|scss|sql|prisma)$/i
const excluded =
  /(?:^|\/)(?:node_modules|dist|build|coverage|\.next|\.turbo|generated|__generated__|vendor)(?:\/|$)|(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|(?:\.test|\.spec|\.integration\.test)\.[cm]?[jt]sx?$/i
const paths = []
const objects = []
for (const entry of tree.toString('utf8').split('\0')) {
  if (!entry) continue
  const tab = entry.indexOf('\t')
  const metadata = entry.slice(0, tab).split(' ')
  const path = entry.slice(tab + 1)
  if (
    metadata[1] !== 'blob' ||
    !allowed.test(path) ||
    excluded.test(path) ||
    !(
      path.startsWith('apps/') ||
      path.startsWith('packages/') ||
      path.startsWith('scripts/')
    )
  )
    continue
  paths.push(path)
  objects.push(metadata[2])
}
const result = spawnSync('git', ['cat-file', '--batch'], {
  input: `${objects.join('\n')}\n`,
  maxBuffer: 256 * 1024 * 1024,
})
if (result.status !== 0 || !result.stdout) {
  throw new Error(result.stderr?.toString() || 'git cat-file failed')
}
let offset = 0
let lines = 0
for (let index = 0; index < objects.length; index += 1) {
  const headerEnd = result.stdout.indexOf(10, offset)
  if (headerEnd < 0) throw new Error('Truncated git object header')
  const [oid, type, rawSize] = result.stdout
    .subarray(offset, headerEnd)
    .toString()
    .split(' ')
  if (oid !== objects[index] || type !== 'blob')
    throw new Error('Unexpected git object')
  const size = Number(rawSize)
  const content = result.stdout
    .subarray(headerEnd + 1, headerEnd + 1 + size)
    .toString('utf8')
  lines += content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length
  offset = headerEnd + 1 + size + 1
}
console.log(`Revision: ${revision}`)
console.log(`Implementation files: ${paths.length}`)
console.log(`Nonempty implementation LOC: ${lines}`)
