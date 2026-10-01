import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../apps/web/public/service-worker.js', import.meta.url), 'utf8')
test('uses release-scoped Warka cache and cleans only its prefix', () => { assert.match(source, /CACHE_PREFIX.*warka-shell-/); assert.match(source, /\$\{CACHE_PREFIX\}0\.1\.0/); assert.match(source, /key\.startsWith\(CACHE_PREFIX\)/) })
test('bypasses API and private downloads while caching only shell assets', () => { assert.match(source, /pathname\.startsWith\('\/api\/'\)/); assert.match(source, /downloads/); assert.match(source, /SHELL\.includes/); assert.doesNotMatch(source, /students|notifications/) })
