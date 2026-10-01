import { pathToFileURL } from 'node:url'

export function planRecoveryDrill(environment, acknowledged) {
  if (
    !['test', 'drill'].includes(environment) ||
    acknowledged !== 'I_ACKNOWLEDGE_ISOLATED_DRILL'
  ) {
    throw new Error(
      'Recovery drill requires an explicitly acknowledged isolated drill target',
    )
  }
  return {
    environment,
    productionMutation: false,
    trafficSwitch: false,
    steps: [
      'selectBackup',
      'verifyBackup',
      'restoreIsolated',
      'validateMigrations',
      'verifyInvariants',
      'representativeReads',
      'recordResult',
    ],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(
      JSON.stringify(
        planRecoveryDrill(
          process.env.WARKA_DRILL_ENV,
          process.env.WARKA_DRILL_ACK,
        ),
      ),
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        code: 'ISOLATED_DRILL_REQUIRED',
        message: error.message,
      }),
    )
    process.exitCode = 1
  }
}
