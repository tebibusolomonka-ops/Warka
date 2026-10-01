import { pathToFileURL } from 'node:url'

export function runIncidentDrill(environment, scenario = 'database') {
  if (environment !== 'test')
    throw new Error('Incident drills are restricted to the test environment')
  if (!['database', 'scanner'].includes(scenario))
    throw new Error('Unknown controlled drill scenario')
  const events =
    scenario === 'database'
      ? [
          'databaseUnavailable',
          'readinessDegraded',
          'alertOpened',
          'incidentDeclared',
          'databaseRecovered',
          'alertResolved',
          'recoveryRecorded',
        ]
      : [
          'scannerUnavailable',
          'filesRemainQuarantined',
          'alertOpened',
          'scannerRecovered',
          'alertResolved',
        ]
  return { ok: true, environment, scenario, productionFault: false, events }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(
      JSON.stringify(runIncidentDrill(process.env.NODE_ENV, process.argv[2])),
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        code: 'TEST_ENVIRONMENT_REQUIRED',
        message: error.message,
      }),
    )
    process.exitCode = 1
  }
}
