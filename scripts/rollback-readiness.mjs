export function evaluateRollbackReadiness(current, target) {
  const reasons = []
  if (current.profile !== target.profile)
    reasons.push('configurationProfileMismatch')
  if (current.migrationCompatibility === 'incompatible')
    reasons.push('incompatibleSchemaChange')
  if (current.migrationCompatibility === 'additive')
    reasons.push('additiveMigrationReview')
  if (reasons.includes('incompatibleSchemaChange'))
    return { status: 'blocked', reasons }
  if (reasons.length) return { status: 'requiresReview', reasons }
  return { status: 'eligible', reasons }
}
