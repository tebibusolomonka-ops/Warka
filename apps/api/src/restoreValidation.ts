export type RestoreEvidence = {
  isolatedTarget: boolean
  restoreExitCode: number
  migrationsCurrent: boolean
  coreTablesReadable: boolean
  invariantViolations: number
  checksumsMatch: boolean
}

export function validateRestore(evidence: RestoreEvidence) {
  const failures: string[] = []
  if (!evidence.isolatedTarget) failures.push('TARGET_NOT_ISOLATED')
  if (evidence.restoreExitCode !== 0) failures.push('RESTORE_FAILED')
  if (!evidence.migrationsCurrent) failures.push('MIGRATIONS_INVALID')
  if (!evidence.coreTablesReadable) failures.push('CORE_TABLES_UNREADABLE')
  if (evidence.invariantViolations > 0)
    failures.push('DOMAIN_INVARIANTS_FAILED')
  if (!evidence.checksumsMatch) failures.push('CHECKSUM_MISMATCH')
  return {
    restoreCompleted: evidence.restoreExitCode === 0,
    integrityPassed: failures.length === 0,
    failures,
  }
}
