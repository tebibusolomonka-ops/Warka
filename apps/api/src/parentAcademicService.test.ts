import type { PrismaClient } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eligibleParentChildren } from './parentPortalService.js'
import {
  ParentChildNotFoundError,
  prismaParentAcademicService,
} from './parentAcademicService.js'

vi.mock('./parentPortalService.js', () => ({ eligibleParentChildren: vi.fn() }))

const child = {
  studentId: 'student-1',
  guardianId: 'guardian-1',
  studentReference: 'WKA-123',
  displayName: 'Child',
  schoolId: 'school-1',
  school: 'School',
  academicYear: 'Year',
  academicYearId: 'year-1',
  gradeLevel: 'Grade',
  schoolClass: 'Class',
  schoolClassId: 'class-1',
  relationship: 'Parent',
}
const results = vi.fn()
const announcements = vi.fn()
const materials = vi.fn()
const database = {
  publishedResult: { findMany: results },
  announcement: { findMany: announcements },
  learningMaterial: { findMany: materials },
} as unknown as PrismaClient

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(eligibleParentChildren).mockResolvedValue([child])
})

describe('parent academic access', () => {
  it('returns current published result values for the eligible child and school', async () => {
    results.mockResolvedValue([
      {
        id: 'result-1',
        createdAt: new Date(),
        currentPercentage: { toNumber: () => 92 },
        currentGradeLabel: 'A',
        resultSet: {
          status: 'published',
          publishedAt: new Date('2026-09-01'),
          academicYear: { name: 'Year' },
          gradingPeriod: { name: 'Term' },
          subject: { name: 'Math' },
        },
        corrections: [{ id: 'correction' }],
      },
    ])
    const response = await prismaParentAcademicService(database).results(
      'user-1',
      child.studentReference,
    )
    expect(response).toEqual([
      {
        academicYear: 'Year',
        gradingPeriod: 'Term',
        subject: 'Math',
        percentage: 92,
        gradeLabel: 'A',
        publishedAt: '2026-09-01T00:00:00.000Z',
        corrected: true,
      },
    ])
    expect(results.mock.calls[0][0].where).toMatchObject({
      studentId: child.studentId,
      schoolId: child.schoolId,
      resultSet: { status: 'published', publishedAt: { not: null } },
    })
  })

  it('limits announcements and materials to the current school and class', async () => {
    announcements.mockResolvedValue([
      {
        id: 'announcement',
        title: 'Notice',
        body: '<b>Plain text</b>',
        publishedAt: new Date('2026-09-01'),
        schoolClass: null,
      },
    ])
    materials.mockResolvedValue([
      {
        id: 'material',
        title: 'Resource',
        description: null,
        resourceType: 'link',
        resourceLocation: 'https://example.test/resource',
        publishedAt: new Date('2026-09-01'),
        subject: { name: 'Math' },
      },
    ])
    const service = prismaParentAcademicService(database)
    expect(
      (await service.announcements('user-1', child.studentReference))[0].body,
    ).toBe('<b>Plain text</b>')
    expect(
      (await service.materials('user-1', child.studentReference))[0]
        .resourceLocation,
    ).toBe('https://example.test/resource')
    expect(announcements.mock.calls[0][0].where.schoolId).toBe(child.schoolId)
    expect(announcements.mock.calls[0][0].where.AND[1].OR).toContainEqual({
      schoolClassId: child.schoolClassId,
    })
    expect(materials.mock.calls[0][0].where).toMatchObject({
      schoolId: child.schoolId,
      academicYearId: child.academicYearId,
      schoolClassId: child.schoolClassId,
    })
  })

  it('rejects an unrelated, revoked, or disabled child before any record query', async () => {
    vi.mocked(eligibleParentChildren).mockResolvedValue([])
    const service = prismaParentAcademicService(database)
    await expect(service.results('user-1', 'OTHER')).rejects.toBeInstanceOf(
      ParentChildNotFoundError,
    )
    await expect(
      service.announcements('user-1', 'OTHER'),
    ).rejects.toBeInstanceOf(ParentChildNotFoundError)
    await expect(service.materials('user-1', 'OTHER')).rejects.toBeInstanceOf(
      ParentChildNotFoundError,
    )
    expect(results).not.toHaveBeenCalled()
    expect(announcements).not.toHaveBeenCalled()
    expect(materials).not.toHaveBeenCalled()
  })
})
