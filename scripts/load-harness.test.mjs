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

test('builds only read requests from explicit synthetic fixture identifiers', () => {
  const id = '123e4567-e89b-42d3-a456-426614174001'
  const config = loadConfiguration({
    WARKA_LOAD_TARGET: 'http://127.0.0.1:3000',
    WARKA_LOAD_ENV: 'test',
    WARKA_LOAD_ACK: 'test',
    WARKA_LOAD_PROFILE: 'representativeReads',
    WARKA_LOAD_SCHOOL_ID: id,
    WARKA_LOAD_ATTENDANCE_SESSION_ID: id,
    WARKA_LOAD_ACADEMIC_YEAR_ID: id,
    WARKA_LOAD_GRADING_PERIOD_ID: id,
    WARKA_LOAD_SCHOOL_CLASS_ID: id,
    WARKA_LOAD_SUBJECT_ID: id,
    WARKA_LOAD_COOKIE: 'warka_session=synthetic-secret',
  })
  assert.equal(config.requests.length, 6)
  assert.ok(
    config.requests.every(
      (request) => !request.method || request.method === 'GET',
    ),
  )
  assert.ok(
    config.requests.some(
      (request) => request.title === 'attendance roster read',
    ),
  )
  assert.doesNotMatch(JSON.stringify(config.requests), /synthetic-secret/)
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
