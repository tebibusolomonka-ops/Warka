import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfiguration } from './load-harness.mjs'

test('requires explicit target and matching environment acknowledgement', () => {
  assert.throws(() => loadConfiguration({}), /WARKA_LOAD_TARGET/)
  assert.throws(
    () =>
      loadConfiguration({
        WARKA_LOAD_TARGET: 'http://127.0.0.1:3000',
        WARKA_LOAD_ENV: 'local',
        WARKA_LOAD_ACK: 'staging',
      }),
    /must match/,
  )
})

test('accepts a bounded deterministic local smoke profile', () => {
  const config = loadConfiguration({
    WARKA_LOAD_TARGET: 'http://127.0.0.1:3000/api',
    WARKA_LOAD_ENV: 'local',
    WARKA_LOAD_ACK: 'local',
  })
  assert.equal(config.target, 'http://127.0.0.1:3000')
  assert.equal(config.profileName, 'smoke')
  assert.equal(config.connections, 1)
  assert.deepEqual(config.requests, [{ path: '/health' }])
})

test('blocks obvious production targets without a separate override', () => {
  assert.throws(
    () =>
      loadConfiguration({
        WARKA_LOAD_TARGET: 'https://app.warka.example',
        WARKA_LOAD_ENV: 'staging',
        WARKA_LOAD_ACK: 'staging',
      }),
    /explicit override/,
  )
})
