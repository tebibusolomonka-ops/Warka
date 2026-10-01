import assert from 'node:assert/strict'
import test from 'node:test'
import { runIncidentDrill } from './incident-drill.mjs'

test('incident drill refuses production', () => {
  assert.throws(() => runIncidentDrill('production'))
})

test('database drill records degradation and factual recovery', () => {
  const result = runIncidentDrill('test', 'database')
  assert.deepEqual(result.events.slice(0, 4), [
    'databaseUnavailable',
    'readinessDegraded',
    'alertOpened',
    'incidentDeclared',
  ])
  assert.ok(result.events.includes('alertResolved'))
})

test('scanner drill never releases quarantined files during outage', () => {
  assert.ok(
    runIncidentDrill('test', 'scanner').events.includes(
      'filesRemainQuarantined',
    ),
  )
})
