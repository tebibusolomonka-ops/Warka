import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  findPossibleDuplicates,
  registerStudentRecord,
} from './studentRegistration.js'

const schoolId = '123e4567-e89b-42d3-a456-426614174000'
const existing = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  studentReference: 'WKA-AAAAAAAAAAAAAAAAAAAA',
  givenName: 'Hana  ',
  familyName: 'Bekele',
  dateOfBirth: new Date('2018-02-28T00:00:00.000Z'),
}
const registered = {
  ...existing,
  id: '123e4567-e89b-42d3-a456-426614174002',
  studentReference: 'WKA-BBBBBBBBBBBBBBBBBBBB',
}

describe('possible duplicate review', () => {
  it('warns on normalized name and birth date without merging', async () => {
    const findMany = vi.fn().mockResolvedValue([
      existing,
      {
        ...existing,
        id: 'other',
        dateOfBirth: new Date('2017-02-28T00:00:00.000Z'),
      },
      { ...existing, id: 'another', familyName: 'Different' },
    ])
    const create = vi.fn().mockResolvedValue(registered)
    const database = {
      student: { findMany, create },
    } as unknown as PrismaClient
    const result = await registerStudentRecord(database, schoolId, {
      givenName: '  HANA ',
      familyName: ' bekele ',
      dateOfBirth: '2018-02-28',
    })
    expect(result.possibleDuplicates).toEqual([existing])
    expect(result.student).toEqual(registered)
    expect(create).toHaveBeenCalledOnce()
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: { some: { schoolId } },
        }),
      }),
    )
  })

  it('does not guess when birth date is missing', async () => {
    const findMany = vi.fn()
    const database = { student: { findMany } } as unknown as PrismaClient
    await expect(
      findPossibleDuplicates(database, schoolId, { givenName: 'Hana' }),
    ).resolves.toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})
