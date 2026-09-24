import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import {
  StudentPortalAccessError,
  type StudentPortalService,
} from './studentPortalService.js'

const linkedId = randomUUID()
const staffId = randomUUID()
const auth: AuthService = {
  async login() {
    return null
  },
  async currentUser(token) {
    return [linkedId, staffId].includes(token)
      ? ({
          id: token,
          email: 'person@example.test',
          displayName: 'Person',
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies User)
      : null
  },
  async logout() {},
}
const studentPortal: StudentPortalService = {
  async results(userId) {
    if (userId !== linkedId) throw new StudentPortalAccessError()
    return [
      {
        academicYear: '2026',
        gradingPeriod: 'Term 1',
        subject: 'Math',
        percentage: 87,
        gradeLabel: 'A',
        publishedAt: new Date().toISOString(),
        corrected: false,
      },
    ]
  },
  async identity(userId) {
    if (userId !== linkedId) throw new StudentPortalAccessError()
    return {
      studentReference: 'WKA-TEST',
      givenName: 'Hana',
      familyName: null,
      currentEnrollment: null,
    }
  },
}

describe('student identity route', () => {
  it('uses the authenticated user without accepting a student identifier', async () => {
    const app = buildApp({ auth, studentPortal })
    try {
      const anonymous = await app.inject({ method: 'GET', url: '/student/me' })
      expect(anonymous.statusCode).toBe(401)
      const staff = await app.inject({
        method: 'GET',
        url: '/student/me',
        headers: { cookie: `warka_session=${staffId}` },
      })
      expect(staff.statusCode).toBe(403)
      const linked = await app.inject({
        method: 'GET',
        url: '/student/me',
        headers: { cookie: `warka_session=${linkedId}` },
      })
      expect(linked.statusCode).toBe(200)
      expect(linked.json()).toMatchObject({
        studentReference: 'WKA-TEST',
        givenName: 'Hana',
      })
      expect(linked.body).not.toContain('guardian')
      const results = await app.inject({
        method: 'GET',
        url: '/student/results',
        headers: { cookie: `warka_session=${linkedId}` },
      })
      expect(results.statusCode).toBe(200)
      expect(results.json()[0]).toMatchObject({
        subject: 'Math',
        percentage: 87,
      })
      const staffResults = await app.inject({
        method: 'GET',
        url: '/student/results',
        headers: { cookie: `warka_session=${staffId}` },
      })
      expect(staffResults.statusCode).toBe(403)
      const guessed = await app.inject({
        method: 'GET',
        url: `/student/${randomUUID()}`,
        headers: { cookie: `warka_session=${linkedId}` },
      })
      expect(guessed.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })
})
