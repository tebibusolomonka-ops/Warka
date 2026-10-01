import test from 'node:test'
import { spawnSync } from 'node:child_process'

test('production API container policy passes', () => {
  const result = spawnSync(process.execPath, ['scripts/container-check.mjs'], {
    cwd: new URL('..', import.meta.url),
  })
  if (result.status !== 0) throw new Error(result.stderr.toString())
})
