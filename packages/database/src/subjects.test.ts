import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  createSubject,
  findSubjectById,
  listSubjectsForSchool,
} from './subjects.js'

describe('subjects', () => {
  it('normalizes optional codes and scopes lookup and listing', async () => {
    const database = {
      subject: {
        create: vi.fn().mockImplementation(async ({ data }) => data),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient
    await createSubject(database, {
      schoolId: '123e4567-e89b-42d3-a456-426614174001',
      name: ' Mathematics ',
      code: ' math.1 ',
    })
    expect(database.subject.create).toHaveBeenCalledWith({
      data: {
        schoolId: '123e4567-e89b-42d3-a456-426614174001',
        name: 'Mathematics',
        code: 'MATH.1',
      },
    })
    await createSubject(database, {
      schoolId: '123e4567-e89b-42d3-a456-426614174001',
      name: 'Reading',
    })
    await findSubjectById(
      database,
      '123e4567-e89b-42d3-a456-426614174001',
      '123e4567-e89b-42d3-a456-426614174002',
    )
    await listSubjectsForSchool(
      database,
      '123e4567-e89b-42d3-a456-426614174001',
    )
    expect(database.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: '123e4567-e89b-42d3-a456-426614174002',
        schoolId: '123e4567-e89b-42d3-a456-426614174001',
      },
    })
    expect(database.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: '123e4567-e89b-42d3-a456-426614174001' },
      }),
    )
    await expect(
      createSubject(database, {
        schoolId: 'bad',
        name: 'Reading',
      }),
    ).rejects.toThrow()
  })
})
