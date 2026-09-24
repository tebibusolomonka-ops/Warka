import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  LearningMaterialAccessError,
  LearningMaterialInputSchema,
  prismaLearningMaterialService,
} from './learningMaterialService.js'

const schoolId = randomUUID()
const academicYearId = randomUUID()
const schoolClassId = randomUUID()
const subjectId = randomUUID()
const actorId = randomUUID()
const input = {
  academicYearId,
  schoolClassId,
  subjectId,
  title: 'Practice',
  resourceType: 'link' as const,
  resourceLocation: 'https://school.example.test/practice',
  publish: true,
}

function store(role: string | null, assigned = true) {
  return {
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue(role ? { role } : null),
    },
    teachingAssignment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(assigned ? { id: randomUUID() } : null),
    },
    academicYear: {
      findFirst: vi.fn().mockResolvedValue({ id: academicYearId }),
    },
    schoolClass: {
      findFirst: vi.fn().mockResolvedValue({ id: schoolClassId }),
    },
    subject: { findFirst: vi.fn().mockResolvedValue({ id: subjectId }) },
    learningMaterial: {
      create: vi.fn().mockImplementation(async ({ data }) => data),
      findMany: vi.fn().mockResolvedValue([]),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue(null) },
    enrollment: { findFirst: vi.fn() },
  }
}

describe('learning materials', () => {
  it('accepts HTTPS links and rejects unsafe schemes', () => {
    expect(LearningMaterialInputSchema.safeParse(input).success).toBe(true)
    for (const resourceLocation of [
      'javascript:alert(1)',
      'http://example.test/file',
      'data:text/html,test',
    ]) {
      expect(
        LearningMaterialInputSchema.safeParse({ ...input, resourceLocation })
          .success,
      ).toBe(false)
    }
  })

  it('allows an assigned teacher and an administrator, but rejects wrong assignments and other roles', async () => {
    const teacher = store('teacher')
    await prismaLearningMaterialService(
      teacher as unknown as PrismaClient,
    ).create(actorId, schoolId, input)
    expect(teacher.learningMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId,
        schoolClassId,
        subjectId,
        createdById: actorId,
      }),
    })
    for (const [role, assigned] of [
      ['teacher', false],
      ['registrar', true],
      ['approver', true],
      [null, true],
    ] as const) {
      const denied = store(role, assigned)
      await expect(
        prismaLearningMaterialService(denied as unknown as PrismaClient).create(
          actorId,
          schoolId,
          input,
        ),
      ).rejects.toBeInstanceOf(LearningMaterialAccessError)
      expect(denied.learningMaterial.create).not.toHaveBeenCalled()
    }
    const administrator = store('administrator', false)
    await prismaLearningMaterialService(
      administrator as unknown as PrismaClient,
    ).create(actorId, schoolId, input)
    expect(administrator.learningMaterial.create).toHaveBeenCalledOnce()
  })

  it('returns only published materials for the linked student�s current approved class', async () => {
    const database = store(null)
    database.studentAccess.findUnique.mockResolvedValue({
      studentId: randomUUID(),
    })
    database.enrollment.findFirst.mockResolvedValue({
      schoolId,
      academicYearId,
      schoolClassId,
    })
    database.learningMaterial.findMany.mockResolvedValue([
      {
        id: randomUUID(),
        title: 'Practice',
        description: null,
        resourceType: 'link',
        resourceLocation: input.resourceLocation,
        subject: { name: 'Math' },
        academicYear: { name: '2026' },
        publishedAt: new Date('2026-09-01'),
      },
    ])
    const items = await prismaLearningMaterialService(
      database as unknown as PrismaClient,
    ).studentList(actorId, new Date('2026-09-24'))
    expect(items).toMatchObject([
      { title: 'Practice', subject: 'Math', academicYear: '2026' },
    ])
    expect(database.learningMaterial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId,
          academicYearId,
          schoolClassId,
          publishedAt: { lte: new Date('2026-09-24') },
        }),
      }),
    )
    expect(database.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'approved' }),
      }),
    )
  })

  it('denies an unlinked account before querying materials', async () => {
    const database = store(null)
    await expect(
      prismaLearningMaterialService(
        database as unknown as PrismaClient,
      ).studentList(actorId),
    ).rejects.toBeInstanceOf(LearningMaterialAccessError)
    expect(database.learningMaterial.findMany).not.toHaveBeenCalled()
  })
})
