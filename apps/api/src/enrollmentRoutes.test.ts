import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  EnrollmentNotFoundError,
  InvalidEnrollmentTransitionError,
  type Enrollment,
  type School,
  type User,
} from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { EnrollmentService } from './enrollmentService.js'
import type { SchoolAccess } from './schoolAccess.js'
import type { SchoolStore } from './schoolService.js'

const school = {
  id: randomUUID(),
  organizationId: randomUUID(),
  name: 'First school',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies School
const otherSchool = { ...school, id: randomUUID(), name: 'Other school' }
const enrollment = {
  id: randomUUID(),
  studentId: randomUUID(),
  schoolId: school.id,
  academicYearId: randomUUID(),
  gradeLevelId: randomUUID(),
  schoolClassId: null,
  status: 'draft',
  approvedAt: null,
  approvedById: null,
  withdrawnAt: null,
  withdrawnById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Enrollment
const actors = {
  owner: randomUUID(),
  organizationAdministrator: randomUUID(),
  schoolAdministrator: randomUUID(),
  registrar: randomUUID(),
  approver: randomUUID(),
  teacher: randomUUID(),
  outsider: randomUUID(),
}
const submitters = new Set([
  actors.owner,
  actors.organizationAdministrator,
  actors.schoolAdministrator,
  actors.registrar,
])
const approvers = new Set([
  actors.owner,
  actors.organizationAdministrator,
  actors.schoolAdministrator,
  actors.approver,
])
const withdrawers = new Set([
  actors.owner,
  actors.organizationAdministrator,
  actors.schoolAdministrator,
])

function cookie(userId: string) {
  return { cookie: 'warka_session=' + userId }
}

function path(
  action: string,
  schoolId = school.id,
  enrollmentId = enrollment.id,
) {
  return '/schools/' + schoolId + '/enrollments/' + enrollmentId + '/' + action
}

function testApp() {
  const auth: AuthService = {
    async login() {
      return null
    },
    async currentUser(token) {
      if (token === 'unknown') return null
      return {
        id: token,
        email: token + '@example.test',
        displayName: token,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies User
    },
    async logout() {},
  }
  const store: SchoolStore = {
    async findOrganizationById() {
      return null
    },
    async createSchool() {
      return school
    },
    async findSchoolById(id) {
      return id === school.id
        ? school
        : id === otherSchool.id
          ? otherSchool
          : null
    },
    async listSchoolsForOrganization() {
      return []
    },
  }
  const access: SchoolAccess = {
    async organizationsForUser() {
      return []
    },
    async canManageOrganization() {
      return false
    },
    async canViewSchool() {
      return false
    },
    async canRegisterStudents() {
      return false
    },
    async canSubmitEnrollment(userId, item) {
      return item.id === school.id && submitters.has(userId)
    },
    async canApproveEnrollment(userId, item) {
      return item.id === school.id && approvers.has(userId)
    },
    async canWithdrawEnrollment(userId, item) {
      return item.id === school.id && withdrawers.has(userId)
    },
  }
  const enrollments: EnrollmentService = {
    submit: vi.fn().mockResolvedValue({ ...enrollment, status: 'pending' }),
    approve: vi
      .fn()
      .mockImplementation(
        async (_schoolId: string, _enrollmentId: string, userId: string) => ({
          ...enrollment,
          status: 'approved',
          approvedAt: new Date('2026-09-24T10:00:00.000Z'),
          approvedById: userId,
        }),
      ),
    withdraw: vi
      .fn()
      .mockImplementation(
        async (_schoolId: string, _enrollmentId: string, userId: string) => ({
          ...enrollment,
          status: 'withdrawn',
          withdrawnAt: new Date('2026-09-25T10:00:00.000Z'),
          withdrawnById: userId,
        }),
      ),
  }
  return { app: buildApp({ auth, store, access, enrollments }), enrollments }
}

describe('enrollment actions', () => {
  it('requires authentication for all actions', async () => {
    const { app } = testApp()
    try {
      for (const action of ['submit', 'approve', 'withdraw']) {
        const response = await app.inject({
          method: 'POST',
          url: path(action),
        })
        expect(response.statusCode).toBe(401)
      }
    } finally {
      await app.close()
    }
  })

  it('lets registrars and administrators submit drafts', async () => {
    const { app, enrollments } = testApp()
    try {
      for (const userId of submitters) {
        const response = await app.inject({
          method: 'POST',
          url: path('submit'),
          headers: cookie(userId),
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().status).toBe('pending')
      }
      expect(enrollments.submit).toHaveBeenCalledWith(school.id, enrollment.id)
      const denied = await app.inject({
        method: 'POST',
        url: path('submit'),
        headers: cookie(actors.teacher),
      })
      expect(denied.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })

  it('lets approvers and administrators approve and records the actor', async () => {
    const { app, enrollments } = testApp()
    try {
      for (const userId of approvers) {
        const response = await app.inject({
          method: 'POST',
          url: path('approve'),
          headers: cookie(userId),
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().status).toBe('approved')
        expect(response.json().approvedById).toBe(userId)
        expect(enrollments.approve).toHaveBeenCalledWith(
          school.id,
          enrollment.id,
          userId,
        )
      }
      for (const userId of [actors.teacher, actors.registrar]) {
        const denied = await app.inject({
          method: 'POST',
          url: path('approve'),
          headers: cookie(userId),
        })
        expect(denied.statusCode).toBe(404)
      }
    } finally {
      await app.close()
    }
  })

  it('limits withdrawal to administrators and records the actor', async () => {
    const { app } = testApp()
    try {
      for (const userId of withdrawers) {
        const response = await app.inject({
          method: 'POST',
          url: path('withdraw'),
          headers: cookie(userId),
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().status).toBe('withdrawn')
        expect(response.json().withdrawnById).toBe(userId)
      }
      const denied = await app.inject({
        method: 'POST',
        url: path('withdraw'),
        headers: cookie(actors.registrar),
      })
      expect(denied.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })

  it('rejects cross-school requests and invalid transitions without rewriting history', async () => {
    const { app, enrollments } = testApp()
    try {
      const crossSchool = await app.inject({
        method: 'POST',
        url: path('approve', otherSchool.id),
        headers: cookie(actors.approver),
      })
      expect(crossSchool.statusCode).toBe(404)
      expect(enrollments.approve).not.toHaveBeenCalled()

      vi.mocked(enrollments.approve).mockRejectedValueOnce(
        new InvalidEnrollmentTransitionError(),
      )
      const repeated = await app.inject({
        method: 'POST',
        url: path('approve'),
        headers: cookie(actors.approver),
      })
      expect(repeated.statusCode).toBe(409)
      expect(repeated.json().error.code).toBe('INVALID_ENROLLMENT_TRANSITION')

      vi.mocked(enrollments.submit).mockRejectedValueOnce(
        new EnrollmentNotFoundError(),
      )
      const missing = await app.inject({
        method: 'POST',
        url: path('submit', school.id, randomUUID()),
        headers: cookie(actors.registrar),
      })
      expect(missing.statusCode).toBe(404)
      expect(missing.json().error.code).toBe('ENROLLMENT_NOT_FOUND')
    } finally {
      await app.close()
    }
  })
})
