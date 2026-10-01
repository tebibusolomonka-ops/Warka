import { describe, expect, it } from 'vitest'
import { missingPilotPrerequisites } from './pilotReadiness.js'

describe('pilot readiness facts', () => {
  it('keeps every missing prerequisite explicit without a school score', () => {
    const missing = missingPilotPrerequisites({ primaryContactConfirmed: true })
    expect(missing).toContain('trainingComplete')
    expect(missing).toContain('supportCoverageConfirmed')
    expect(missing).not.toContain('primaryContactConfirmed')
  })
})
