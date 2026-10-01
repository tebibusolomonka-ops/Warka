import assert from 'node:assert/strict'
import test from 'node:test'
import { runSmoke, smokeConfiguration } from './deployment-smoke.mjs'

test('requires an explicit approved target', () => {
  assert.throws(() => smokeConfiguration({}), /required/)
  assert.equal(
    smokeConfiguration({ WARKA_SMOKE_TARGET: 'http://localhost:8080' })
      .hostname,
    'localhost',
  )
  assert.throws(
    () => smokeConfiguration({ WARKA_SMOKE_TARGET: 'https://example.org' }),
    /ALLOW_PRODUCTION/,
  )
})

test('uses only safe read requests', async () => {
  const requests = []
  await runSmoke(new URL('http://localhost'), async (url, options) => {
    requests.push([url.pathname, options])
    return { status: 200 }
  })
  assert.equal(requests.length, 6)
  assert.ok(requests.every(([, options]) => options.redirect === 'manual'))
})
