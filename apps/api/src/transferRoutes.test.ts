import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { TransferManagementService } from './transferManagementService.js'

const actorId = randomUUID()
const schoolId = randomUUID()
const transferId = randomUUID()
const studentId = randomUUID()
const sourceEnrollmentId = randomUUID()
const receivingSchoolId = randomUUID()
const yearId = randomUUID()
const gradeId = randomUUID()
const now = '2026-09-25T08:00:00.000Z'
const transfer = {
  id: transferId,
  status: 'requested' as const,
  student: { displayName: 'Mina Learner', studentReference: 'WKA-1' },
  sendingSchool: 'Sending School',
  receivingSchool: 'Receiving School',
  sourceEnrollment: {
    status: 'approved' as const,
    academicYear: '2026',
    gradeLevel: 'Grade 2',
    schoolClass: null,
  },
  receivingEnrollment: null,
  requestedAt: now,
  sendingApprovedAt: null,
  completedAt: null,
  rejectionReason: null,
  cancellationReason: null,
}
const auth: AuthService = {
  async login() {
    return null
  },
  async currentUser(token) {
    return token === actorId
      ? ({
          id: actorId,
          email: 'registrar@example.test',
          displayName: 'Registrar',
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies User)
      : null
  },
  async logout() {},
}
const transfers: TransferManagementService = {
  options: vi.fn(async () => ({
    eligibleStudents: [
      {
        studentId,
        studentReference: 'WKA-1',
        displayName: 'Mina Learner',
        sourceEnrollmentId,
        academicYear: '2026',
        gradeLevel: 'Grade 2',
      },
    ],
    receivingSchools: [{ id: receivingSchoolId, name: 'Receiving School' }],
    academicYears: [{ id: yearId, name: '2026' }],
    gradeLevels: [{ id: gradeId, name: 'Grade 2' }],
    classes: [],
  })),
  list: vi.fn(async () => [transfer]),
  detail: vi.fn(async () => transfer),
  request: vi.fn(async () => transfer),
  approve: vi.fn(async () => ({
    ...transfer,
    status: 'approvedBySendingSchool',
  })),
  accept: vi.fn(async () => ({
    ...transfer,
    status: 'acceptedByReceivingSchool',
    receivingEnrollment: {
      status: 'pending',
      academicYear: '2026',
      gradeLevel: 'Grade 2',
      schoolClass: null,
    },
    completedAt: now,
  })),
  reject: vi.fn(async () => ({ ...transfer, status: 'rejected' })),
  cancel: vi.fn(async () => ({ ...transfer, status: 'cancelled' })),
}

describe('transfer management routes', () => {
  it('requires authentication and calls explicit actor-scoped actions', async () => {
    const app = buildApp({ auth, transfers })
    const root = '/schools/' + schoolId + '/transfers'
    const headers = { cookie: 'warka_session=' + actorId }
    try {
      expect(
        (await app.inject({ method: 'GET', url: root + '/incoming' }))
          .statusCode,
      ).toBe(401)
      const options = await app.inject({
        method: 'GET',
        url: root + '/options',
        headers,
      })
      expect(options.statusCode).toBe(200)
      expect(options.json().eligibleStudents[0].studentReference).toBe('WKA-1')
      const outgoing = await app.inject({
        method: 'GET',
        url: root + '/outgoing',
        headers,
      })
      expect(outgoing.statusCode).toBe(200)
      expect(transfers.list).toHaveBeenCalledWith(actorId, schoolId, 'outgoing')
      const incoming = await app.inject({
        method: 'GET',
        url: root + '/incoming',
        headers,
      })
      expect(incoming.statusCode).toBe(200)
      expect(transfers.list).toHaveBeenCalledWith(actorId, schoolId, 'incoming')
      const detail = await app.inject({
        method: 'GET',
        url: root + '/' + transferId,
        headers,
      })
      expect(detail.statusCode).toBe(200)
      expect(detail.body).not.toMatch(
        /guardian|password|email|sourceEnrollmentId/i,
      )
      const created = await app.inject({
        method: 'POST',
        url: root,
        headers,
        payload: { studentId, sourceEnrollmentId, receivingSchoolId },
      })
      expect(created.statusCode).toBe(201)
      expect(transfers.request).toHaveBeenCalledWith(
        actorId,
        schoolId,
        studentId,
        sourceEnrollmentId,
        receivingSchoolId,
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: root,
            headers,
            payload: {
              studentId,
              sourceEnrollmentId,
              receivingSchoolId,
              status: 'acceptedByReceivingSchool',
            },
          })
        ).statusCode,
      ).toBe(400)
      const actionPath = root + '/' + transferId
      expect(
        (
          await app.inject({
            method: 'POST',
            url: actionPath + '/approve',
            headers,
          })
        ).statusCode,
      ).toBe(200)
      expect(transfers.approve).toHaveBeenCalledWith(
        actorId,
        schoolId,
        transferId,
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: actionPath + '/accept',
            headers,
            payload: { academicYearId: yearId, gradeLevelId: gradeId },
          })
        ).statusCode,
      ).toBe(200)
      expect(transfers.accept).toHaveBeenCalledWith(
        actorId,
        schoolId,
        transferId,
        { academicYearId: yearId, gradeLevelId: gradeId },
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: actionPath + '/reject',
            headers,
            payload: { reason: 'No seat' },
          })
        ).statusCode,
      ).toBe(200)
      expect(transfers.reject).toHaveBeenCalledWith(
        actorId,
        schoolId,
        transferId,
        'No seat',
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: actionPath + '/cancel',
            headers,
            payload: { reason: 'Changed plans' },
          })
        ).statusCode,
      ).toBe(200)
      expect(transfers.cancel).toHaveBeenCalledWith(
        actorId,
        schoolId,
        transferId,
        'Changed plans',
      )
    } finally {
      await app.close()
    }
  })
})
