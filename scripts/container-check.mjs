import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const api = await readFile(
  new URL('../Dockerfile.api', import.meta.url),
  'utf8',
)
const ignore = await readFile(
  new URL('../.dockerignore', import.meta.url),
  'utf8',
)

assert.match(api, /pnpm install --frozen-lockfile/)
assert.match(api, /pnpm db:generate/)
assert.match(api, /pnpm build:api/)
assert.match(api, /deploy --prod/)
assert.match(api, /CMD \["node", "dist\/server\.js"\]/)
assert.doesNotMatch(api, /migrate (dev|deploy)|db:deploy/)
for (const entry of [
  '.git',
  '.env',
  '**/node_modules',
  'knowledge',
  '.backups',
])
  assert.ok(
    ignore.split(/\r?\n/).includes(entry),
    `.dockerignore must exclude ${entry}`,
  )
