import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { User, IssuedDocument } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { DocumentDownloadService } from './documentDownloadService.js'

const actorId = randomUUID()
const schoolId = randomUUID()
const documentId = randomUUID()
const reference = 'WRK-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const auth: AuthService = {
  async login() {
    return null
  },
  async currentUser(token) {
    return token === actorId
      ? ({
          id: actorId,
          email: 'student@example.test',
          displayName: 'Student',
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies User)
      : null
  },
  async logout() {},
}
const downloads: DocumentDownloadService = {
  async find() {
    return {
      id: documentId,
      schoolId,
      documentType: 'reportCard',
      verificationReference: reference,
      snapshot: {
        student: { displayName: 'Student', studentReference: 'WRK-1' },
        issuingSchool: 'School',
        documentType: 'reportCard',
        issuedAt: '2026-09-26T10:00:00.000Z',
        academicYear: '2025/26',
        subjects: [
          {
            subject: 'Math',
            gradingPeriod: 'Term 1',
            percentage: 80,
            gradeLabel: 'B',
          },
        ],
      },
    } as IssuedDocument
  },
}

describe('document download route', () => {
  it('requires authentication and returns PDF with safe headers', async () => {
    const original = process.env.PUBLIC_BASE_URL
    process.env.PUBLIC_BASE_URL = 'https://example.test/'
    const app = buildApp({ auth, downloads })
    const path = `/schools/${schoolId}/documents/${documentId}/download`
    try {
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(
        401,
      )
      const reply = await app.inject({
        method: 'GET',
        url: path,
        headers: { cookie: `warka_session=${actorId}` },
      })
      expect(reply.statusCode).toBe(200)
      expect(reply.headers['content-type']).toContain('application/pdf')
      expect(reply.headers['content-disposition']).toBe(
        `attachment; filename="warka-report-card-${documentId}.pdf"`,
      )
      expect(reply.rawPayload.subarray(0, 5).toString()).toBe('%PDF-')
      expect(
        (
          await app.inject({
            method: 'GET',
            url: `/verify/documents/${reference}`,
          })
        ).headers['content-type'],
      ).not.toContain('application/pdf')
    } finally {
      await app.close()
      if (original === undefined) delete process.env.PUBLIC_BASE_URL
      else process.env.PUBLIC_BASE_URL = original
    }
  })
})
