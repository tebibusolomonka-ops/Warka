import { describe, expect, it } from 'vitest'
import { supplyChainStatus } from './supplyChainStatus.js'

describe('supply chain status', () => {
  it('returns safe validated build and CI metadata', () => {
    const result = supplyChainStatus({
      WARKA_BUILD_COMMIT_SHA: 'a'.repeat(40),
      WARKA_DEPENDENCY_AUDIT_STATUS: 'passed',
      WARKA_DEPENDENCY_AUDIT_TIMESTAMP: '2026-09-30T00:00:00Z',
      WARKA_SBOM_AVAILABLE: 'true',
      WARKA_DEPENDENCY_METADATA_WARNING_COUNT: '1',
    })
    expect(result.sbom.specification).toBe('CycloneDX 1.6')
    expect(result.dependencyMetadataWarningCount).toBe(1)
    expect(JSON.stringify(result)).not.toContain('TOKEN')
  })

  it('does not reflect untrusted status values', () => {
    expect(
      supplyChainStatus({ WARKA_DEPENDENCY_AUDIT_STATUS: 'token=secret' })
        .dependencyAudit.status,
    ).toBe('unknown')
  })
})
