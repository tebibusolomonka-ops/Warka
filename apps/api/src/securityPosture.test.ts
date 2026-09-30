import { expect, it } from 'vitest'
import { securityPosture } from './securityPosture.js'

it('reports factual safe security posture without secrets or scores', () => {
  const result = securityPosture(
    { WARKA_ALLOWED_ORIGINS: 'https://app.test', WARKA_SBOM_AVAILABLE: 'true' },
    { throttled: 2, quarantined: 1 },
  )
  expect(result.csrfProtection).toBe('enabled')
  expect(result.recentQuarantinedFileCount).toBe(1)
  expect(JSON.stringify(result)).not.toMatch(/secret|password|token|score/i)
})
