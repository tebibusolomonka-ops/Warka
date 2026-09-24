import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from '@warka/database'
import { prismaStudentService } from './studentService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)(
  'student registration transaction in PostgreSQL',
  () => {
    it('registers a draft with guardians and rolls back later failures', async () => {
      const organization = await database!.organization.create({
        data: { name: 'Student API transaction test' },
      })
      const school = await database!.school.create({
        data: { organizationId: organization.id, name: 'First school' },
      })
      const otherSchool = await database!.school.create({
        data: { organizationId: organization.id, name: 'Other school' },
      })
      const year = await database!.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'First year',
          startsOn: new Date('2026-09-11T00:00:00.000Z'),
          endsOn: new Date('2027-09-10T00:00:00.000Z'),
        },
      })
      const grade = await database!.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade 1' },
      })
      const service = prismaStudentService(database!)
      const studentIds: string[] = []
      const guardianIds: string[] = []

      try {
        const input = {
          student: {
            givenName: 'Hana',
            familyName: 'Bekele',
            dateOfBirth: '2018-02-28',
          },
          academicYearId: year.id,
          gradeLevelId: grade.id,
          guardians: [
            {
              name: 'Selam',
              phone: '+251 900 000 000',
              relationship: 'Aunt',
            },
          ],
        }
        const first = await service.register(school.id, input)
        studentIds.push(first.student.id)
        guardianIds.push(first.guardians[0]!.guardian.id)
        expect(first.enrollment.status).toBe('draft')
        expect(first.guardians[0]?.guardian.phone).toBe('+251 900 000 000')
        expect(first.possibleDuplicates).toEqual([])
        expect(await service.list(school.id, 10, 0)).toMatchObject([
          {
            student: { id: first.student.id },
            enrollment: { status: 'draft' },
          },
        ])
        expect(await service.list(otherSchool.id, 10, 0)).toEqual([])
        expect(await service.find(otherSchool.id, first.student.id)).toBeNull()
        expect(await service.find(school.id, first.student.id)).toMatchObject({
          student: { id: first.student.id },
          guardians: [{ relationship: 'Aunt' }],
        })

        const second = await service.register(school.id, {
          ...input,
          guardians: [],
        })
        studentIds.push(second.student.id)
        expect(second.student.id).not.toBe(first.student.id)
        expect(second.possibleDuplicates).toMatchObject([
          { id: first.student.id },
        ])

        await expect(
          service.register(school.id, {
            ...input,
            student: { givenName: 'Rollback year' },
            academicYearId: otherSchool.id,
            guardians: [],
          }),
        ).rejects.toThrow()
        expect(
          await database!.student.count({
            where: { givenName: 'Rollback year' },
          }),
        ).toBe(0)

        await expect(
          service.register(school.id, {
            ...input,
            student: { givenName: 'Rollback guardian' },
            guardians: [
              {
                name: 'Rollback contact',
                relationship: ' ',
              },
            ],
          }),
        ).rejects.toThrow()
        expect(
          await database!.student.count({
            where: { givenName: 'Rollback guardian' },
          }),
        ).toBe(0)
        expect(
          await database!.guardian.count({
            where: { name: 'Rollback contact' },
          }),
        ).toBe(0)
      } finally {
        await database!.studentGuardian.deleteMany({
          where: { studentId: { in: studentIds } },
        })
        await database!.enrollment.deleteMany({
          where: { schoolId: school.id },
        })
        await database!.guardian.deleteMany({
          where: { id: { in: guardianIds } },
        })
        await database!.student.deleteMany({
          where: { id: { in: studentIds } },
        })
        await database!.gradeLevel.delete({ where: { id: grade.id } })
        await database!.academicYear.delete({ where: { id: year.id } })
        await database!.school.deleteMany({
          where: { organizationId: organization.id },
        })
        await database!.organization.delete({ where: { id: organization.id } })
      }
    })
  },
)
