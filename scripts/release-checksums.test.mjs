import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { artifactChecksums } from './release-checksums.mjs'

test('creates stable SHA-256 entries with repository-relative names', () => {
  const root = mkdtempSync(join(tmpdir(), 'warka-checksums-'))
  try {
    mkdirSync(join(root, 'dist'))
    writeFileSync(join(root, 'dist', 'app.js'), 'warka')
    const first = artifactChecksums(root, [join(root, 'dist')])
    const second = artifactChecksums(root, [join(root, 'dist')])
    assert.deepEqual(first, second)
    assert.equal(first[0].name, 'dist/app.js')
    assert.match(first[0].checksum, /^[a-f0-9]{64}$/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
