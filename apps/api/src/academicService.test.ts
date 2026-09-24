import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  AcademicAccessError,
  prismaAcademicService,
} from './academicService.js'

const schoolId = randomUUID()
const otherSchoolId = randomUUID()
const organizationId = randomUUID()
const otherOrganizationId = randomUUID()
const teacherId = randomUUID()
const administratorId = randomUUID()
const registrarId = randomUUID()
const ownerId = randomUUID()
const outsiderId = randomUUID()
const context = {
  schoolId,
  academicYearId: randomUUID(),
  gradingPeriodId: randomUUID(),
  schoolClassId: randomUUID(),
  subjectId: randomUUID(),
}

function fixture() {
  const database = {
    school: {
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          where.id === schoolId
            ? { organizationId }
            : where.id === otherSchoolId
              ? { organizationId: otherOrganizationId }
              : null,
        ),
    },
    organizationMembership: {
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          where.userId_organizationId.userId === ownerId &&
          where.userId_organizationId.organizationId === organizationId
            ? { role: 'owner' }
            : null,
        ),
    },
    schoolMembership: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        if (where.userId_schoolId.schoolId !== schoolId) return null
        const roles: Record<string, string> = {
          [teacherId]: 'teacher',
          [administratorId]: 'administrator',
          [registrarId]: 'registrar',
        }
        const role = roles[where.userId_schoolId.userId]
        return role ? { role } : null
      }),
    },
    teachingAssignment: {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          where.userId === teacherId &&
          where.schoolClassId === context.schoolClassId
            ? { id: randomUUID() }
            : null,
        ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    subject: {
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: randomUUID(),
        ...data,
      })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    assessment: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient
  return { database, service: prismaAcademicService(database) }
}

describe('academic service authorization', () => {
  it('allows school administrators and organization owners to configure only their school', async () => {
    const { database, service } = fixture()
    await service.createSubject(administratorId, { schoolId, name: 'Science' })
    await service.createSubject(ownerId, { schoolId, name: 'Language' })
    expect(database.subject.create).toHaveBeenCalledTimes(2)
    await expect(
      service.createSubject(registrarId, { schoolId, name: 'Science' }),
    ).rejects.toBeInstanceOf(AcademicAccessError)
    await expect(
      service.createSubject(teacherId, { schoolId, name: 'Science' }),
    ).rejects.toBeInstanceOf(AcademicAccessError)
    await expect(
      service.createSubject(ownerId, {
        schoolId: otherSchoolId,
        name: 'Science',
      }),
    ).rejects.toBeInstanceOf(AcademicAccessError)
    await expect(
      service.createSubject(outsiderId, { schoolId, name: 'Science' }),
    ).rejects.toBeInstanceOf(AcademicAccessError)
  })

  it('limits teachers to current assignments and excludes registrars from academic views', async () => {
    const { database, service } = fixture()
    await service.assessments(teacherId, context)
    expect(database.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId,
          schoolClassId: context.schoolClassId,
        }),
      }),
    )
    await expect(
      service.assessments(teacherId, {
        ...context,
        schoolClassId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(AcademicAccessError)
    await expect(
      service.assessments(registrarId, context),
    ).rejects.toBeInstanceOf(AcademicAccessError)
    await expect(
      service.assessments(teacherId, { ...context, schoolId: otherSchoolId }),
    ).rejects.toBeInstanceOf(AcademicAccessError)
    await service.assessments(administratorId, {
      ...context,
      schoolClassId: randomUUID(),
    })
  })

  it('returns only the teacher own assignments', async () => {
    const { database, service } = fixture()
    await service.assignments(teacherId, schoolId)
    expect(database.teachingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId, userId: teacherId },
      }),
    )
    await expect(
      service.assignments(registrarId, schoolId),
    ).rejects.toBeInstanceOf(AcademicAccessError)
  })
})
