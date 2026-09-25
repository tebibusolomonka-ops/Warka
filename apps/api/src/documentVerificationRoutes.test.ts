import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { DocumentVerificationService } from './documentVerificationService.js'

const activeReference = 'WRK-' + 'A'.repeat(32)
const correctedReference = 'WRK-' + 'B'.repeat(32)
const withdrawnReference = 'WRK-' + 'C'.repeat(32)
const otherReference = 'WRK-' + 'D'.repeat(32)

const verification: DocumentVerificationService = {
  async verify(reference) {
    if (reference === correctedReference) return { status: 'corrected' }
    if (reference === withdrawnReference) return { status: 'withdrawn' }
    if (reference === activeReference || reference === otherReference)
      return {
        status: 'active',
        documentType:
          reference === activeReference ? 'transcript' : 'reportCard',
        issuingSchool: 'Issuing School',
        student: {
          displayName:
            reference === activeReference ? 'Mira Learner' : 'Another Learner',
          studentReference: reference === activeReference ? 'WKA-1' : 'WKA-2',
        },
        issuedAt: '2026-09-25T08:00:00.000Z',
        academicYear: '2026',
        subjects: [
          {
            subject: 'Mathematics',
            gradingPeriod: 'Term 1',
            percentage: 85,
            gradeLabel: 'B',
          },
        ],
      }
    return { status: 'unavailable' }
  },
}

describe('public document verification', () => {
  it('returns only safe fields for active and neutral statuses for other references', async () => {
    const app = buildApp({ verification })
    try {
      const active = await app.inject({
        method: 'GET',
        url: '/verify/documents/' + activeReference,
      })
      expect(active.statusCode).toBe(200)
      expect(active.json()).toEqual({
        status: 'active',
        documentType: 'transcript',
        issuingSchool: 'Issuing School',
        student: { displayName: 'Mira Learner', studentReference: 'WKA-1' },
        issuedAt: '2026-09-25T08:00:00.000Z',
        academicYear: '2026',
        subjects: [
          {
            subject: 'Mathematics',
            gradingPeriod: 'Term 1',
            percentage: 85,
            gradeLabel: 'B',
          },
        ],
      })
      for (const forbidden of [
        'guardian',
        'email',
        'phone',
        'password',
        'session',
        'issuedBy',
        'studentId',
        'schoolId',
      ])
        expect(active.body).not.toContain(forbidden)
      for (const [reference, status] of [
        [correctedReference, 'corrected'],
        [withdrawnReference, 'withdrawn'],
        ['WRK-' + 'E'.repeat(32), 'unavailable'],
        ['malformed', 'unavailable'],
      ]) {
        const response = await app.inject({
          method: 'GET',
          url: '/verify/documents/' + reference,
        })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ status })
      }
      const other = await app.inject({
        method: 'GET',
        url: '/verify/documents/' + otherReference,
      })
      expect(other.json().student.displayName).toBe('Another Learner')
      expect(other.body).not.toContain('Mira Learner')
    } finally {
      await app.close()
    }
  })

  it('throttles repeated requests without disclosing records', async () => {
    const app = buildApp({ verification })
    try {
      for (let count = 0; count < 30; count++)
        expect(
          (
            await app.inject({
              method: 'GET',
              url: '/verify/documents/malformed',
            })
          ).statusCode,
        ).toBe(200)
      const limited = await app.inject({
        method: 'GET',
        url: '/verify/documents/' + activeReference,
      })
      expect(limited.statusCode).toBe(429)
      expect(limited.json()).toEqual({ status: 'unavailable' })
      expect(limited.headers['retry-after']).toBeDefined()
    } finally {
      await app.close()
    }
  })
})
