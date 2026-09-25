import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  DuplicateActiveTransferError,
  findTransferForSchool,
  listSchoolTransfers,
  requestTransfer,
  TransferPermissionError,
  TransferSourceError,
  TransferPackageSchema,
} from './transfers.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('transfer requests in PostgreSQL', () => {
  it('captures only approved source context without changing either enrollment', async () => {
    const organization = await database!.organization.create({
      data: { name: 'Transfer test ' + randomUUID() },
    })
    const sending = await database!.school.create({
      data: { organizationId: organization.id, name: 'Sending School' },
    })
    const receiving = await database!.school.create({
      data: { organizationId: organization.id, name: 'Receiving School' },
    })
    const unrelated = await database!.school.create({
      data: { organizationId: organization.id, name: 'Unrelated School' },
    })
    const actor = await database!.user.create({
      data: {
        email: 'transfer-sender-' + randomUUID() + '@example.test',
        displayName: 'Sending Registrar',
        schoolMemberships: {
          create: { schoolId: sending.id, role: 'registrar' },
        },
      },
    })
    const reviewer = await database!.user.create({
      data: {
        email: 'transfer-receiver-' + randomUUID() + '@example.test',
        displayName: 'Receiving Approver',
        schoolMemberships: {
          create: { schoolId: receiving.id, role: 'approver' },
        },
      },
    })
    const outsider = await database!.user.create({
      data: {
        email: 'transfer-outsider-' + randomUUID() + '@example.test',
        displayName: 'Unrelated Approver',
        schoolMemberships: {
          create: { schoolId: unrelated.id, role: 'approver' },
        },
      },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: sending.id,
        name: 'Source year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: sending.id, name: 'Grade 2' },
    })
    const student = await database!.student.create({
      data: { studentReference: 'TRANSFER-' + randomUUID(), givenName: 'Mina' },
    })
    const otherStudent = await database!.student.create({
      data: { studentReference: 'TRANSFER-' + randomUUID(), givenName: 'Nora' },
    })
    const source = await database!.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: sending.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: actor.id,
      },
    })
    const input = {
      studentId: student.id,
      sendingSchoolId: sending.id,
      receivingSchoolId: receiving.id,
      sourceEnrollmentId: source.id,
    }
    try {
      await expect(
        requestTransfer(database!, actor.id, {
          ...input,
          receivingSchoolId: sending.id,
        }),
      ).rejects.toBeInstanceOf(TransferSourceError)
      await expect(
        requestTransfer(database!, actor.id, {
          ...input,
          sourceEnrollmentId: randomUUID(),
        }),
      ).rejects.toBeInstanceOf(TransferSourceError)
      await expect(
        requestTransfer(database!, actor.id, {
          ...input,
          studentId: otherStudent.id,
        }),
      ).rejects.toBeInstanceOf(TransferSourceError)
      await expect(
        requestTransfer(database!, reviewer.id, input),
      ).rejects.toBeInstanceOf(TransferPermissionError)
      const transfer = await requestTransfer(database!, actor.id, input)
      expect(transfer.status).toBe('requested')
      expect(transfer.requestedById).toBe(actor.id)
      expect(TransferPackageSchema.parse(transfer.transferPackage)).toEqual({
        student: {
          displayName: 'Mina',
          studentReference: student.studentReference,
        },
        sendingSchool: 'Sending School',
        sourceAcademicYear: 'Source year',
        sourceGradeLevel: 'Grade 2',
        sourceClass: null,
        sourceEnrollmentStatus: 'approved',
      })
      expect(JSON.stringify(transfer.transferPackage)).not.toMatch(
        /password|guardian|email|phone|audit|draft/i,
      )
      expect(
        (await database!.enrollment.findUnique({ where: { id: source.id } }))
          ?.status,
      ).toBe('approved')
      expect(
        await database!.enrollment.count({ where: { schoolId: receiving.id } }),
      ).toBe(0)
      await expect(
        requestTransfer(database!, actor.id, input),
      ).rejects.toBeInstanceOf(DuplicateActiveTransferError)
      expect(
        (await listSchoolTransfers(database!, actor.id, sending.id)).map(
          (item) => item.id,
        ),
      ).toContain(transfer.id)
      expect(
        (await listSchoolTransfers(database!, reviewer.id, receiving.id)).map(
          (item) => item.id,
        ),
      ).toContain(transfer.id)
      expect(
        await listSchoolTransfers(database!, outsider.id, unrelated.id),
      ).toEqual([])
      expect(
        await findTransferForSchool(
          database!,
          outsider.id,
          unrelated.id,
          transfer.id,
        ),
      ).toBeNull()
      await expect(
        listSchoolTransfers(database!, actor.id, receiving.id),
      ).rejects.toBeInstanceOf(TransferPermissionError)
    } finally {
      await database!.transferRequest.deleteMany({
        where: { sendingSchoolId: sending.id },
      })
      await database!.enrollment.deleteMany({ where: { schoolId: sending.id } })
      await database!.gradeLevel.deleteMany({ where: { schoolId: sending.id } })
      await database!.academicYear.deleteMany({
        where: { schoolId: sending.id },
      })
      await database!.student.delete({ where: { id: student.id } })
      await database!.student.delete({ where: { id: otherStudent.id } })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: { in: [sending.id, receiving.id, unrelated.id] } },
      })
      await database!.user.deleteMany({
        where: { id: { in: [actor.id, reviewer.id, outsider.id] } },
      })
      await database!.school.deleteMany({
        where: { id: { in: [sending.id, receiving.id, unrelated.id] } },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
