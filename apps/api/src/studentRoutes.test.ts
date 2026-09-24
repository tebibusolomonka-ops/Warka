import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  InvalidEnrollmentStructureError,
  type Enrollment,
  type Guardian,
  type School,
  type Student,
  type User,
} from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { SchoolAccess } from './schoolAccess.js'
import type { SchoolStore } from './schoolService.js'
import type { StudentService } from './studentService.js'
import type { StudentOptionsService } from './studentOptionsService.js'
import type { StudentAccountService } from './studentAccountService.js'

const school = {
  id: randomUUID(),
  organizationId: randomUUID(),
  name: 'First school',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies School
const otherSchool = { ...school, id: randomUUID(), name: 'Other school' }
const student = {
  id: randomUUID(),
  studentReference: 'WKA-AAAAAAAAAAAAAAAAAAAA',
  givenName: 'Hana',
  familyName: 'Bekele',
  dateOfBirth: new Date('2018-02-28T00:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Student
const enrollment = {
  id: randomUUID(),
  studentId: student.id,
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
const guardian = {
  id: randomUUID(),
  name: 'Selam',
  phone: '+251 900 000 000',
  email: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Guardian
const input = {
  student: {
    givenName: 'Hana',
    familyName: 'Bekele',
    dateOfBirth: '2018-02-28',
  },
  academicYearId: enrollment.academicYearId,
  gradeLevelId: enrollment.gradeLevelId,
  guardians: [
    {
      name: 'Selam',
      phone: '+251 900 000 000',
      relationship: 'Aunt',
    },
  ],
}
const roles = new Set([
  'owner',
  'administrator',
  'schoolAdministrator',
  'registrar',
])

function cookie(userId: string) {
  return { cookie: 'warka_session=' + userId }
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
    async schoolsForUser() {
      return []
    },
    async organizationsForUser() {
      return []
    },
    async canManageOrganization() {
      return false
    },
    async canViewSchool() {
      return false
    },
    async canRegisterStudents(userId, item) {
      return roles.has(userId) && item.id === school.id
    },
    async canSubmitEnrollment() {
      return false
    },
    async canApproveEnrollment(userId, item) {
      return userId === 'approver' && item.id === school.id
    },
    async canWithdrawEnrollment() {
      return false
    },
  }
  const students: StudentService = {
    register: vi.fn().mockResolvedValue({
      student,
      enrollment,
      guardians: [{ guardian, relationship: 'Aunt' }],
      possibleDuplicates: [student],
    }),
    list: vi.fn().mockResolvedValue([{ student, enrollment }]),
    find: vi.fn().mockResolvedValue({
      student,
      enrollments: [enrollment],
      guardians: [{ guardian, relationship: 'Aunt' }],
    }),
  }
  const studentOptions: StudentOptionsService = {
    list: vi.fn().mockResolvedValue({
      academicYears: [{ id: enrollment.academicYearId, name: '2026' }],
      gradeLevels: [{ id: enrollment.gradeLevelId, name: 'Grade 1' }],
      classes: [],
    }),
  }
  const studentAccounts: StudentAccountService = {
    create: vi.fn().mockResolvedValue({
      id: randomUUID(),
      email: 'student@example.test',
      displayName: 'Student',
      mustChangePassword: true,
    }),
  }
  return {
    app: buildApp({
      auth,
      store,
      access,
      students,
      studentOptions,
      studentAccounts,
    }),
    studentAccounts,
    students,
    studentOptions,
  }
}

describe('student routes', () => {
  it('provisions only for authorized school staff and never returns the initial password', async () => {
    const { app, studentAccounts } = testApp()
    const payload = {
      email: 'student@example.test',
      displayName: 'Student',
      initialPassword: 'initial password',
    }
    try {
      const url = `/schools/${school.id}/students/${student.id}/access`
      const anonymous = await app.inject({ method: 'POST', url, payload })
      expect(anonymous.statusCode).toBe(401)
      for (const role of ['teacher', 'approver']) {
        const denied = await app.inject({
          method: 'POST',
          url,
          headers: cookie(role),
          payload,
        })
        expect(denied.statusCode).toBe(404)
      }
      const other = await app.inject({
        method: 'POST',
        url: `/schools/${otherSchool.id}/students/${student.id}/access`,
        headers: cookie('registrar'),
        payload,
      })
      expect(other.statusCode).toBe(404)
      const allowed = await app.inject({
        method: 'POST',
        url,
        headers: cookie('registrar'),
        payload,
      })
      expect(allowed.statusCode).toBe(201)
      expect(allowed.json()).toMatchObject({
        email: payload.email,
        mustChangePassword: true,
      })
      expect(allowed.body).not.toContain(payload.initialPassword)
      expect(studentAccounts.create).toHaveBeenCalledWith(
        school.id,
        student.id,
        payload,
      )
    } finally {
      await app.close()
    }
  })
  it('requires authentication on every route', async () => {
    const { app } = testApp()
    try {
      for (const response of [
        app.inject({
          method: 'POST',
          url: '/schools/' + school.id + '/students',
          payload: input,
        }),
        app.inject('/schools/' + school.id + '/students'),
        app.inject('/schools/' + school.id + '/student-options'),
        app.inject('/schools/' + school.id + '/students/' + student.id),
      ]) {
        expect((await response).statusCode).toBe(401)
      }
    } finally {
      await app.close()
    }
  })

  it('provides school-scoped academic choices to registration roles', async () => {
    const { app, studentOptions } = testApp()
    try {
      const allowed = await app.inject({
        url: '/schools/' + school.id + '/student-options',
        headers: cookie('registrar'),
      })
      expect(allowed.statusCode).toBe(200)
      expect(allowed.json().academicYears[0].id).toBe(enrollment.academicYearId)
      expect(studentOptions.list).toHaveBeenCalledWith(school.id)
      for (const userId of ['teacher', 'approver', 'outsider']) {
        const denied = await app.inject({
          url: '/schools/' + school.id + '/student-options',
          headers: cookie(userId),
        })
        expect(denied.statusCode).toBe(404)
      }
      const crossSchool = await app.inject({
        url: '/schools/' + otherSchool.id + '/student-options',
        headers: cookie('registrar'),
      })
      expect(crossSchool.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })

  it('allows approvers to read pending students without registration permission', async () => {
    const { app } = testApp()
    try {
      const list = await app.inject({
        url: '/schools/' + school.id + '/students',
        headers: cookie('approver'),
      })
      const detail = await app.inject({
        url: '/schools/' + school.id + '/students/' + student.id,
        headers: cookie('approver'),
      })
      expect(list.statusCode).toBe(200)
      expect(detail.statusCode).toBe(200)
      const crossSchool = await app.inject({
        url: '/schools/' + otherSchool.id + '/students',
        headers: cookie('approver'),
      })
      expect(crossSchool.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })

  it('registers for allowed roles and returns a draft, guardian, and review warning', async () => {
    const { app, students } = testApp()
    try {
      for (const userId of roles) {
        const response = await app.inject({
          method: 'POST',
          url: '/schools/' + school.id + '/students',
          headers: cookie(userId),
          payload: input,
        })
        expect(response.statusCode).toBe(201)
        expect(response.json().student.studentReference).toBe(
          student.studentReference,
        )
        expect(response.json().enrollment.status).toBe('draft')
        expect(response.json().guardians[0].relationship).toBe('Aunt')
        expect(response.json().duplicateWarnings).toMatchObject({
          requiresHumanReview: true,
          candidates: [{ id: student.id }],
        })
      }
      expect(students.register).toHaveBeenCalledWith(
        school.id,
        expect.objectContaining({ student: input.student }),
      )
    } finally {
      await app.close()
    }
  })

  it('denies teachers, approvers, and users of another school without revealing records', async () => {
    const { app } = testApp()
    try {
      for (const userId of ['teacher', 'approver', 'outsider']) {
        const response = await app.inject({
          method: 'POST',
          url: '/schools/' + school.id + '/students',
          headers: cookie(userId),
          payload: input,
        })
        expect(response.statusCode).toBe(404)
      }
      const other = await app.inject({
        url: '/schools/' + otherSchool.id + '/students',
        headers: cookie('registrar'),
      })
      const missing = await app.inject({
        url: '/schools/' + randomUUID() + '/students',
        headers: cookie('registrar'),
      })
      expect(other.statusCode).toBe(404)
      expect(other.json()).toEqual(missing.json())
    } finally {
      await app.close()
    }
  })

  it('validates structure and disallows client-selected reference or status', async () => {
    const { app, students } = testApp()
    try {
      for (const payload of [
        { ...input, studentReference: 'WKA-CLIENT' },
        { ...input, status: 'approved' },
        { ...input, academicYearId: 'invalid' },
      ]) {
        const response = await app.inject({
          method: 'POST',
          url: '/schools/' + school.id + '/students',
          headers: cookie('registrar'),
          payload,
        })
        expect(response.statusCode).toBe(400)
      }
      vi.mocked(students.register).mockRejectedValueOnce(
        new InvalidEnrollmentStructureError(),
      )
      const invalidClass = await app.inject({
        method: 'POST',
        url: '/schools/' + school.id + '/students',
        headers: cookie('registrar'),
        payload: { ...input, schoolClassId: randomUUID() },
      })
      expect(invalidClass.statusCode).toBe(400)
      expect(invalidClass.json().error.code).toBe(
        'INVALID_ENROLLMENT_STRUCTURE',
      )
    } finally {
      await app.close()
    }
  })

  it('paginates school results and keeps guardian contacts out of the list', async () => {
    const { app, students } = testApp()
    try {
      const response = await app.inject({
        url: '/schools/' + school.id + '/students?limit=10&offset=20',
        headers: cookie('registrar'),
      })
      expect(response.statusCode).toBe(200)
      expect(students.list).toHaveBeenCalledWith(school.id, 10, 20)
      expect(response.json().items[0].student.id).toBe(student.id)
      expect(JSON.stringify(response.json())).not.toContain(guardian.phone)
      expect(response.json().items[0].student.dateOfBirth).toBeUndefined()
      const invalidPage = await app.inject({
        url: '/schools/' + school.id + '/students?limit=1000',
        headers: cookie('registrar'),
      })
      expect(invalidPage.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('shows detail only within the authorized school and handles missing students', async () => {
    const { app, students } = testApp()
    try {
      const detail = await app.inject({
        url: '/schools/' + school.id + '/students/' + student.id,
        headers: cookie('registrar'),
      })
      expect(detail.statusCode).toBe(200)
      expect(detail.json().guardians[0].guardian.phone).toBe(guardian.phone)
      expect(students.find).toHaveBeenCalledWith(school.id, student.id)
      vi.mocked(students.find).mockResolvedValueOnce(null)
      const missing = await app.inject({
        url: '/schools/' + school.id + '/students/' + randomUUID(),
        headers: cookie('registrar'),
      })
      expect(missing.statusCode).toBe(404)
      const denied = await app.inject({
        url: '/schools/' + otherSchool.id + '/students/' + student.id,
        headers: cookie('registrar'),
      })
      expect(denied.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })
})
