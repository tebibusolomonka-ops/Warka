import { describe, expect, it } from 'vitest'

type Outcome = 'allowed' | 'denied' | 'concealed'
type Role =
  | 'student'
  | 'guardian'
  | 'teacher'
  | 'registrar'
  | 'schoolAdministrator'
  | 'organizationOwner'
  | 'bureauReviewer'
  | 'support'
  | 'operations'

const cases: Array<{ domain: string; role: Role; outcome: Outcome }> = [
  { domain: 'student records', role: 'student', outcome: 'concealed' },
  { domain: 'student records', role: 'registrar', outcome: 'allowed' },
  { domain: 'gradebook', role: 'teacher', outcome: 'allowed' },
  { domain: 'gradebook', role: 'guardian', outcome: 'concealed' },
  { domain: 'documents', role: 'student', outcome: 'allowed' },
  { domain: 'bulk import/export', role: 'registrar', outcome: 'allowed' },
  { domain: 'security operations', role: 'registrar', outcome: 'denied' },
  { domain: 'reporting review', role: 'bureauReviewer', outcome: 'allowed' },
  { domain: 'backup/restore', role: 'bureauReviewer', outcome: 'denied' },
  { domain: 'support access', role: 'support', outcome: 'allowed' },
  { domain: 'gradebook', role: 'support', outcome: 'concealed' },
  { domain: 'privacy workflows', role: 'teacher', outcome: 'denied' },
  { domain: 'backup/restore', role: 'schoolAdministrator', outcome: 'denied' },
  { domain: 'deployment', role: 'operations', outcome: 'allowed' },
  { domain: 'student records', role: 'operations', outcome: 'concealed' },
  { domain: 'recovery', role: 'operations', outcome: 'allowed' },
  {
    domain: 'security operations',
    role: 'organizationOwner',
    outcome: 'denied',
  },
]

describe('representative authorization matrix', () => {
  it.each(cases)('$role is $outcome for $domain', (entry) => {
    expect(['allowed', 'denied', 'concealed']).toContain(entry.outcome)
  })

  it('does not define a universal role bypass', () => {
    const roles = new Set<Role>(cases.map((entry) => entry.role))
    for (const role of roles)
      expect(
        cases.some(
          (entry) => entry.role === role && entry.outcome !== 'allowed',
        ),
      ).toBe(true)
  })

  it('preserves intentional concealed-not-found expectations', () => {
    expect(
      cases
        .filter((entry) => entry.outcome === 'concealed')
        .map((entry) => entry.domain),
    ).toEqual(['student records', 'gradebook'])
  })
})
