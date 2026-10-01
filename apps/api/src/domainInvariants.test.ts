import { describe, expect, it } from 'vitest'

import { verifyDomainInvariants } from './domainInvariants.js'

describe('domain invariant verifier', () => {
  it('returns structured identifiers without private record contents', () => {
    expect(
      verifyDomainInvariants({
        duplicateStudentReferences: ['student-alias-1'],
      }),
    ).toEqual([
      {
        code: 'DUPLICATE_STUDENT_REFERENCE',
        entityType: 'Student',
        entityId: 'student-alias-1',
      },
    ])
  })

  it('reports a clean synthetic snapshot', () => {
    expect(verifyDomainInvariants({})).toEqual([])
  })
})
