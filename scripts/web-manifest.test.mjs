import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('web manifest contains safe install metadata', async () => {
  const manifest = JSON.parse(await readFile(new URL('../apps/web/public/manifest.webmanifest', import.meta.url)))
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith('/') && !JSON.stringify(icon).includes('user')))
})
