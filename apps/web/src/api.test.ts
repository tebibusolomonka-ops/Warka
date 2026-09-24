import { describe, expect, it, vi } from 'vitest'
import {
  actOnEnrollment,
  ApiError,
  apiBaseUrl,
  getAccessibleSchools,
  getCurrentUser,
  getOrganizations,
  getSchools,
  getStudentDetail,
  getStudentOptions,
  getStudents,
  login,
  logout,
  postSchool,
  registerStudent,
} from './api'

const baseUrl = 'http://localhost:5173/api'
const organizationId = '123e4567-e89b-42d3-a456-426614174000'
const user = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  email: 'owner@example.com',
  displayName: 'Owner',
}
const organization = {
  id: organizationId,
  name: 'Regional office',
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
}
const school = {
  ...organization,
  id: '123e4567-e89b-42d3-a456-426614174002',
  organizationId,
  name: 'First school',
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('authenticated API client', () => {
  it('requires a same-origin API URL', () => {
    expect(apiBaseUrl('/api', 'http://localhost:5173')).toBe(baseUrl)
    expect(() => apiBaseUrl(undefined, 'http://localhost:5173')).toThrow()
    expect(() =>
      apiBaseUrl('https://other.example/api', 'http://localhost:5173'),
    ).toThrow()
  })

  it('uses credentials for current user, login, and logout', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce({ ok: true, status: 204 })
    await expect(getCurrentUser(baseUrl, request)).resolves.toEqual(user)
    await expect(
      login(baseUrl, 'owner@example.com', 'secret', request),
    ).resolves.toEqual(user)
    await logout(baseUrl, request)
    expect(request).toHaveBeenNthCalledWith(1, baseUrl + '/auth/me', {
      credentials: 'include',
    })
    expect(request).toHaveBeenNthCalledWith(2, baseUrl + '/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'secret' }),
      credentials: 'include',
    })
    expect(request).toHaveBeenNthCalledWith(3, baseUrl + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('uses credentials and validates organization and school responses', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response([{ organization, role: 'owner' }]))
      .mockResolvedValueOnce(response([school]))
      .mockResolvedValueOnce(response(school, 201))
    await expect(getOrganizations(baseUrl, request)).resolves.toHaveLength(1)
    await expect(getSchools(baseUrl, organizationId, request)).resolves.toEqual(
      [school],
    )
    await expect(
      postSchool(baseUrl, organizationId, 'First school', request),
    ).resolves.toEqual(school)
    for (const call of request.mock.calls) {
      expect(call[1].credentials).toBe('include')
    }
    expect(request).toHaveBeenNthCalledWith(
      3,
      baseUrl + '/organizations/' + organizationId + '/schools',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'First school' }),
        credentials: 'include',
      },
    )
  })

  it('uses authenticated school-scoped endpoints for student work', async () => {
    const studentId = '123e4567-e89b-42d3-a456-426614174003'
    const enrollmentId = '123e4567-e89b-42d3-a456-426614174004'
    const yearId = '123e4567-e89b-42d3-a456-426614174005'
    const gradeId = '123e4567-e89b-42d3-a456-426614174006'
    const student = {
      id: studentId,
      studentReference: 'WKA-123456789',
      givenName: 'Hana',
      familyName: null,
      dateOfBirth: null,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    }
    const enrollment = {
      id: enrollmentId,
      studentId,
      schoolId: school.id,
      academicYearId: yearId,
      gradeLevelId: gradeId,
      schoolClassId: null,
      status: 'draft',
      approvedAt: null,
      approvedById: null,
      withdrawnAt: null,
      withdrawnById: null,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    }
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        response([
          {
            school,
            capabilities: {
              canRegister: true,
              canSubmit: true,
              canApprove: false,
            },
          },
        ]),
      )
      .mockResolvedValueOnce(
        response({
          academicYears: [{ id: yearId, name: '2026' }],
          gradeLevels: [{ id: gradeId, name: 'Grade 1' }],
          classes: [],
        }),
      )
      .mockResolvedValueOnce(
        response({
          items: [
            {
              student: {
                id: studentId,
                studentReference: student.studentReference,
                givenName: student.givenName,
                familyName: null,
              },
              enrollment,
            },
          ],
          limit: 50,
          offset: 0,
        }),
      )
      .mockResolvedValueOnce(
        response({ student, enrollments: [enrollment], guardians: [] }),
      )
      .mockResolvedValueOnce(
        response(
          {
            student,
            enrollment,
            guardians: [],
            duplicateWarnings: { requiresHumanReview: true, candidates: [] },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(response({ ...enrollment, status: 'pending' }))
    await getAccessibleSchools(baseUrl, request)
    await getStudentOptions(baseUrl, school.id, request)
    await getStudents(baseUrl, school.id, 0, request)
    await getStudentDetail(baseUrl, school.id, studentId, request)
    await registerStudent(
      baseUrl,
      school.id,
      {
        student: { givenName: 'Hana' },
        academicYearId: yearId,
        gradeLevelId: gradeId,
      },
      request,
    )
    await actOnEnrollment(baseUrl, school.id, enrollmentId, 'submit', request)
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      baseUrl + '/schools',
      baseUrl + '/schools/' + school.id + '/student-options',
      baseUrl + '/schools/' + school.id + '/students?limit=50&offset=0',
      baseUrl + '/schools/' + school.id + '/students/' + studentId,
      baseUrl + '/schools/' + school.id + '/students',
      baseUrl +
        '/schools/' +
        school.id +
        '/enrollments/' +
        enrollmentId +
        '/submit',
    ])
    for (const [, options] of request.mock.calls) {
      expect(options.credentials).toBe('include')
    }
  })

  it('preserves API status and rejects invalid or unavailable responses', async () => {
    const denied = vi.fn().mockResolvedValue(
      response(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        },
        401,
      ),
    )
    await expect(getCurrentUser(baseUrl, denied)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    } satisfies Partial<ApiError>)
    const invalid = vi
      .fn()
      .mockResolvedValue(response({ displayName: 'Only name' }))
    await expect(getCurrentUser(baseUrl, invalid)).rejects.toThrow()
    const offline = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(getCurrentUser(baseUrl, offline)).rejects.toThrow('offline')
  })
})
