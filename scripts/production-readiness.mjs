import { pathToFileURL } from 'node:url'

export function evaluateReadiness(evidence) {
  const definitions = [
    ['productionConfiguration', true],
    ['migrationState', true],
    ['securityChecks', true],
    ['containerConfiguration', true],
    ['backupConfigured', true],
    ['verifiedBackup', true],
    ['restoreRehearsal', true],
    ['malwareScanning', true],
    ['schedulerHealth', true],
    ['communicationReadiness', false],
    ['releaseConsistency', true],
    ['domainInvariants', true],
    ['releaseCandidateSuite', true],
  ]
  const checks = definitions.map(([id, required]) => {
    const value = evidence[id]
    const state =
      value === true
        ? 'ready'
        : value === false
          ? required
            ? 'blocked'
            : 'warning'
          : 'notChecked'
    return { id, required, state }
  })
  return {
    state: checks.some(({ state }) => state === 'blocked')
      ? 'blocked'
      : checks.some(
            ({ state }) => state === 'notChecked' || state === 'warning',
          )
        ? 'warning'
        : 'ready',
    checks,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidence = process.env.WARKA_READINESS_EVIDENCE
    ? JSON.parse(process.env.WARKA_READINESS_EVIDENCE)
    : {}
  const result = evaluateReadiness(evidence)
  console.log(JSON.stringify(result))
  if (result.state === 'blocked') process.exitCode = 1
}
