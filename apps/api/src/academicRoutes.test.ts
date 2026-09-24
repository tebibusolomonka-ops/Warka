import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MarkPermissionError,
  ResultPermissionError,
  ResultStateError,
  type User,
} from '@warka/database'
import { buildApp } from './app.js'
import { AcademicAccessError, type AcademicService } from './academicService.js'
import type { AuthService } from './authService.js'

const schoolId = randomUUID()
const otherSchoolId = randomUUID()
const context = {
  academicYearId: randomUUID(),
  gradingPeriodId: randomUUID(),
  schoolClassId: randomUUID(),
  subjectId: randomUUID(),
}
const assessmentId = randomUUID()
const enrollmentId = randomUUID()
const markId = randomUUID()
const resultSetId = randomUUID()
const publishedResultId = randomUUID()
const base = '/schools/' + schoolId
const urlContext = new URLSearchParams(context).toString()
const cookie = (actor: string) => ({ cookie: 'warka_session=' + actor })

function fixture() {
  const auth: AuthService = {
    login: vi.fn().mockResolvedValue(null),
    currentUser: vi.fn().mockImplementation(
      async (token: string) =>
        ({
          id: token,
          email: token + '@example.test',
          displayName: token,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) satisfies User,
    ),
    logout: vi.fn().mockResolvedValue(undefined),
  }
  const academic = {
    structure: vi.fn().mockResolvedValue({
      academicYears: [],
      classes: [],
      subjects: [],
      gradingPeriods: [],
      teachers: [],
      role: 'teacher',
    }),
    subjects: vi.fn().mockResolvedValue([]),
    createSubject: vi
      .fn()
      .mockResolvedValue({ id: randomUUID(), name: 'Science' }),
    assignments: vi.fn().mockResolvedValue([]),
    assignTeacher: vi.fn().mockResolvedValue({ id: randomUUID() }),
    periods: vi.fn().mockResolvedValue([]),
    createPeriod: vi.fn().mockResolvedValue({ id: randomUUID() }),
    assessments: vi.fn().mockResolvedValue([]),
    createAssessment: vi.fn().mockResolvedValue({ id: assessmentId }),
    scheme: vi.fn().mockResolvedValue(null),
    saveScheme: vi.fn().mockResolvedValue({ id: randomUUID(), bands: [] }),
    recordMark: vi.fn().mockResolvedValue({ id: markId, score: '12' }),
    updateMark: vi.fn().mockResolvedValue({ id: markId, score: '13' }),
    validateImport: vi.fn().mockResolvedValue({
      valid: true,
      rows: [
        {
          line: 2,
          studentReference: 'WKA-TEST',
          score: '12.00',
          action: 'create',
          studentId: randomUUID(),
          enrollmentId,
        },
      ],
      problems: [],
    }),
    applyImport: vi.fn().mockResolvedValue({ created: 1, updated: 0 }),
    preview: vi
      .fn()
      .mockResolvedValue({ status: 'draft', complete: true, rows: [] }),
    submit: vi.fn().mockResolvedValue({ id: resultSetId, status: 'pending' }),
    pending: vi.fn().mockResolvedValue([]),
    published: vi.fn().mockResolvedValue([]),
    publish: vi
      .fn()
      .mockResolvedValue({ id: resultSetId, status: 'published' }),
    correct: vi
      .fn()
      .mockResolvedValue({ id: randomUUID(), reason: 'Verified change' }),
    corrections: vi.fn().mockResolvedValue([]),
  } as unknown as AcademicService
  return { app: buildApp({ auth, academic }), academic }
}

describe('academic routes', () => {
  const opened: ReturnType<typeof buildApp>[] = []
  afterEach(async () => {
    await Promise.all(opened.splice(0).map((app) => app.close()))
  })
  function testApp() {
    const result = fixture()
    opened.push(result.app)
    return result
  }

  it('requires authentication for setup, mark, import, and publication routes', async () => {
    const { app } = testApp()
    const requests = [
      app.inject(base + '/academic-structure'),
      app.inject(base + '/subjects'),
      app.inject({ method: 'POST', url: base + '/marks', payload: {} }),
      app.inject({
        method: 'POST',
        url: base + '/assessments/' + assessmentId + '/import/apply',
        payload: {},
      }),
      app.inject({
        method: 'POST',
        url: base + '/result-sets/' + resultSetId + '/publish',
        payload: {},
      }),
    ]
    for (const request of requests) expect((await request).statusCode).toBe(401)
  })

  it('enforces school setup access and validates academic configuration', async () => {
    const { app, academic } = testApp()
    const subject = await app.inject({
      method: 'POST',
      url: base + '/subjects',
      headers: cookie('administrator'),
      payload: { name: 'Science' },
    })
    expect(subject.statusCode).toBe(201)
    expect(academic.createSubject).toHaveBeenCalledWith('administrator', {
      schoolId,
      name: 'Science',
    })
    vi.mocked(academic.createSubject).mockRejectedValueOnce(
      new AcademicAccessError(),
    )
    const denied = await app.inject({
      method: 'POST',
      url: base + '/subjects',
      headers: cookie('registrar'),
      payload: { name: 'Science' },
    })
    expect(denied.statusCode).toBe(404)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: base + '/subjects',
          headers: cookie('administrator'),
          payload: { name: '' },
        })
      ).statusCode,
    ).toBe(400)
    const wrongSchool = await app.inject({
      url: '/schools/' + otherSchoolId + '/subjects',
      headers: cookie('administrator'),
    })
    expect(wrongSchool.statusCode).toBe(200)
    expect(academic.subjects).toHaveBeenCalledWith(
      'administrator',
      otherSchoolId,
    )
    const year = await app.inject({
      url: base + '/grading-periods?academicYearId=' + context.academicYearId,
      headers: cookie('administrator'),
    })
    expect(year.statusCode).toBe(200)
    const assignment = await app.inject({
      method: 'POST',
      url: base + '/teaching-assignments',
      headers: cookie('administrator'),
      payload: {
        userId: randomUUID(),
        academicYearId: context.academicYearId,
        schoolClassId: context.schoolClassId,
        subjectId: context.subjectId,
      },
    })
    expect(assignment.statusCode).toBe(201)
    const assessment = await app.inject({
      method: 'POST',
      url: base + '/assessments',
      headers: cookie('administrator'),
      payload: {
        ...context,
        name: 'Quiz',
        maximumScore: '20',
        weight: '100',
        position: 0,
      },
    })
    expect(assessment.statusCode).toBe(201)
  })

  it('routes assigned teacher mark entry and preview while denying invalid and unauthorized marks', async () => {
    const { app, academic } = testApp()
    const mark = await app.inject({
      method: 'POST',
      url: base + '/marks',
      headers: cookie('teacher'),
      payload: { enrollmentId, assessmentId, score: '12' },
    })
    expect(mark.statusCode).toBe(201)
    expect(academic.recordMark).toHaveBeenCalledWith('teacher', {
      schoolId,
      enrollmentId,
      assessmentId,
      score: '12',
    })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: base + '/marks',
          headers: cookie('teacher'),
          payload: { enrollmentId, assessmentId, score: '-1' },
        })
      ).statusCode,
    ).toBe(400)
    vi.mocked(academic.recordMark).mockRejectedValueOnce(
      new MarkPermissionError(),
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url: base + '/marks',
          headers: cookie('registrar'),
          payload: { enrollmentId, assessmentId, score: '12' },
        })
      ).statusCode,
    ).toBe(404)
    vi.mocked(academic.preview).mockRejectedValueOnce(
      new ResultPermissionError(),
    )
    expect(
      (
        await app.inject({
          url: base + '/results/preview?' + urlContext,
          headers: cookie('other-school-teacher'),
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          url: base + '/results/preview?' + urlContext,
          headers: cookie('teacher'),
        })
      ).json(),
    ).toMatchObject({ status: 'draft', complete: true })
    expect(academic.preview).toHaveBeenCalledWith('teacher', {
      schoolId,
      ...context,
    })
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: base + '/marks/' + markId,
          headers: cookie('teacher'),
          payload: { score: '13' },
        })
      ).statusCode,
    ).toBe(200)
  })

  it('returns public import review fields and applies only an explicit valid request', async () => {
    const { app, academic } = testApp()
    const payload = { csv: 'studentReference,score\nWKA-TEST,12' }
    const review = await app.inject({
      method: 'POST',
      url: base + '/assessments/' + assessmentId + '/import/validate',
      headers: cookie('teacher'),
      payload,
    })
    expect(review.statusCode).toBe(200)
    expect(review.json().rows[0]).toEqual({
      line: 2,
      studentReference: 'WKA-TEST',
      score: '12.00',
      action: 'create',
    })
    expect(review.body).not.toContain(enrollmentId)
    expect(academic.applyImport).not.toHaveBeenCalled()
    const applied = await app.inject({
      method: 'POST',
      url: base + '/assessments/' + assessmentId + '/import/apply',
      headers: cookie('teacher'),
      payload,
    })
    expect(applied.json()).toEqual({ created: 1, updated: 0 })
    expect(academic.applyImport).toHaveBeenCalledWith(
      'teacher',
      schoolId,
      assessmentId,
      payload.csv,
    )
  })

  it('exposes submit, pending review, publish, and audited correction actions', async () => {
    const { app, academic } = testApp()
    const submitted = await app.inject({
      method: 'POST',
      url: base + '/results/submit',
      headers: cookie('teacher'),
      payload: context,
    })
    expect(submitted.json()).toMatchObject({ status: 'pending' })
    expect(academic.submit).toHaveBeenCalledWith('teacher', {
      schoolId,
      ...context,
    })
    expect(
      (
        await app.inject({
          url: base + '/result-sets/pending',
          headers: cookie('approver'),
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await app.inject({
          url: base + '/result-sets/published',
          headers: cookie('approver'),
        })
      ).statusCode,
    ).toBe(200)
    expect(academic.published).toHaveBeenCalledWith('approver', schoolId)
    vi.mocked(academic.publish).mockRejectedValueOnce(
      new ResultPermissionError(),
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url: base + '/result-sets/' + resultSetId + '/publish',
          headers: cookie('teacher'),
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: base + '/result-sets/' + resultSetId + '/publish',
          headers: cookie('approver'),
        })
      ).json(),
    ).toMatchObject({ status: 'published' })
    expect(academic.publish).toHaveBeenCalledWith(
      'approver',
      schoolId,
      resultSetId,
    )
    const correction = await app.inject({
      method: 'POST',
      url: base + '/published-results/' + publishedResultId + '/corrections',
      headers: cookie('approver'),
      payload: { percentage: '88', reason: 'Verified change' },
    })
    expect(correction.statusCode).toBe(200)
    expect(academic.correct).toHaveBeenCalledWith(
      'approver',
      schoolId,
      publishedResultId,
      '88',
      'Verified change',
    )
    vi.mocked(academic.correct).mockRejectedValueOnce(
      new ResultPermissionError(),
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url:
            base + '/published-results/' + publishedResultId + '/corrections',
          headers: cookie('teacher'),
          payload: { percentage: '89', reason: 'Verified change' },
        })
      ).statusCode,
    ).toBe(404)
    vi.mocked(academic.submit).mockRejectedValueOnce(new ResultStateError())
    expect(
      (
        await app.inject({
          method: 'POST',
          url: base + '/results/submit',
          headers: cookie('teacher'),
          payload: context,
        })
      ).statusCode,
    ).toBe(409)
  })
})
