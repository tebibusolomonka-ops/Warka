import { describe, expect, it } from 'vitest'
import {
  derivedChecklist,
  ManualChecklistKeySchema,
} from './onboardingChecklist.js'

describe('onboarding checklist', () => {
  it('derives technical completion from actual configuration counts', () => {
    const items = derivedChecklist({
      documentProfile: 0,
      administrator: 1,
      academicYear: 1,
      gradeLevels: 0,
      classes: 0,
      subjects: 0,
      gradingScheme: 0,
      staffAssignments: 0,
    })
    expect(items.find((item) => item.key === 'administrator')?.status).toBe(
      'complete',
    )
    expect(items.find((item) => item.key === 'documentProfile')?.status).toBe(
      'pending',
    )
    expect(items.every((item) => item.source === 'system')).toBe(true)
    expect(ManualChecklistKeySchema.safeParse('administrator').success).toBe(
      false,
    )
  })
})
