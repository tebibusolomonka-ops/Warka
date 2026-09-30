import { buildMetadata } from './buildMetadata.js'

const dateOrNull = (value: string | undefined) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : null

export function supplyChainStatus(env: NodeJS.ProcessEnv) {
  const warningCount = Number.parseInt(
    env.WARKA_DEPENDENCY_METADATA_WARNING_COUNT ?? '',
    10,
  )
  return {
    buildCommit: buildMetadata(env).commitSha,
    dependencyAudit: {
      status: ['passed', 'failed'].includes(
        env.WARKA_DEPENDENCY_AUDIT_STATUS ?? '',
      )
        ? env.WARKA_DEPENDENCY_AUDIT_STATUS
        : 'unknown',
      checkedAt: dateOrNull(env.WARKA_DEPENDENCY_AUDIT_TIMESTAMP),
    },
    sbom: {
      available: env.WARKA_SBOM_AVAILABLE === 'true',
      specification:
        env.WARKA_SBOM_AVAILABLE === 'true' ? 'CycloneDX 1.6' : null,
    },
    workflowPolicyVersion: 1,
    dependencyMetadataWarningCount:
      Number.isInteger(warningCount) && warningCount >= 0 ? warningCount : null,
  }
}
