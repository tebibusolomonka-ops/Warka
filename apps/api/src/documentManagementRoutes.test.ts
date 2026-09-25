import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { DocumentManagementService } from './documentManagementService.js'

const actorId = randomUUID()
const schoolId = randomUUID()
const studentId = randomUUID()
const documentId = randomUUID()
const yearId = randomUUID()
const document = {
  id: documentId,
  documentType: 'transcript',
  verificationReference: 'WRK-' + 'A'.repeat(32),
  status: 'active',
  issuedAt: new Date('2026-09-25T08:00:00.000Z'),
  supersedesId: null,
}
const auth: AuthService = {
  async login() {
    return null
  },
  async currentUser(token) {
    return token === actorId
      ? ({
          id: actorId,
          email: 'approver@example.test',
          displayName: 'Approver',
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies User)
      : null
  },
  async logout() {},
}
const documents = {
  list: vi.fn(async () => ({
    documents: [document],
    eligibleYears: [{ id: yearId, name: '2026' }],
  })),
  issue: vi.fn(async () => document),
  correct: vi.fn(async () => ({
    ...document,
    status: 'active',
    supersedesId: documentId,
  })),
  withdraw: vi.fn(async () => ({ ...document, status: 'withdrawn' })),
} as unknown as DocumentManagementService

describe('school document management routes', () => {
  it('requires session and uses actor and school from the route', async () => {
    const app = buildApp({ auth, documents })
    try {
      const path =
        '/schools/' + schoolId + '/students/' + studentId + '/documents'
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(
        401,
      )
      const headers = { cookie: 'warka_session=' + actorId }
      const list = await app.inject({ method: 'GET', url: path, headers })
      expect(list.statusCode).toBe(200)
      expect(list.json().documents[0]).toEqual({
        id: documentId,
        documentType: 'transcript',
        verificationReference: document.verificationReference,
        status: 'active',
        issuedAt: document.issuedAt.toISOString(),
        supersedesId: null,
      })
      expect(documents.list).toHaveBeenCalledWith(actorId, schoolId, studentId)
      const issued = await app.inject({
        method: 'POST',
        url: path,
        headers,
        payload: { academicYearId: yearId, documentType: 'transcript' },
      })
      expect(issued.statusCode).toBe(201)
      expect(documents.issue).toHaveBeenCalledWith(
        actorId,
        schoolId,
        studentId,
        yearId,
        'transcript',
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: path,
            headers,
            payload: {
              academicYearId: yearId,
              documentType: 'transcript',
              schoolId: randomUUID(),
            },
          })
        ).statusCode,
      ).toBe(400)
      const corrected = await app.inject({
        method: 'POST',
        url: '/schools/' + schoolId + '/documents/' + documentId + '/correct',
        headers,
        payload: { reason: 'Official correction' },
      })
      expect(corrected.statusCode).toBe(201)
      expect(documents.correct).toHaveBeenCalledWith(
        actorId,
        schoolId,
        documentId,
        'Official correction',
      )
      const withdrawn = await app.inject({
        method: 'POST',
        url: '/schools/' + schoolId + '/documents/' + documentId + '/withdraw',
        headers,
        payload: { reason: 'Issued in error' },
      })
      expect(withdrawn.statusCode).toBe(200)
      expect(withdrawn.json().status).toBe('withdrawn')
      expect(documents.withdraw).toHaveBeenCalledWith(
        actorId,
        schoolId,
        documentId,
        'Issued in error',
      )
    } finally {
      await app.close()
    }
  })
})
