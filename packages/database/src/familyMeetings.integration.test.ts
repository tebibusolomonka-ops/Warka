import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  FamilyMeetingAccessError,
  requestFamilyMeeting,
} from './familyMeetings.js'
import {
  MeetingSchedulingError,
  scheduleFamilyMeeting,
} from './meetingScheduling.js'
import {
  cancelFamilyMeeting,
  completeFamilyMeeting,
  listMeetingHistory,
} from './meetingHistory.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => database?.$disconnect())

describe.skipIf(!database)('family meeting requests in PostgreSQL', () => {
  it('accepts only a verified guardian and a current teacher of the linked class', async () => {
    const db = database!
    const organization = await db.organization.create({
      data: { name: randomUUID() },
    })
    const school = await db.school.create({
      data: { organizationId: organization.id, name: 'Meeting school' },
    })
    const guardianUser = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Guardian' },
    })
    const studentUser = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Student' },
    })
    const teacher = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, displayName: 'Teacher' },
    })
    const unrelatedTeacher = await db.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        displayName: 'Unrelated teacher',
      },
    })
    const guardian = await db.guardian.create({ data: { name: 'Guardian' } })
    const student = await db.student.create({
      data: { studentReference: randomUUID(), givenName: 'Learner' },
    })
    try {
      await db.guardianAccess.create({
        data: { userId: guardianUser.id, guardianId: guardian.id },
      })
      await db.studentAccess.create({
        data: { userId: studentUser.id, studentId: student.id },
      })
      await db.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: 'parent',
          verificationStatus: 'verified',
          verificationSchoolId: school.id,
          verifiedAt: new Date(),
        },
      })
      const year = await db.academicYear.create({
        data: {
          schoolId: school.id,
          name: 'Year',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      })
      const grade = await db.gradeLevel.create({
        data: { schoolId: school.id, name: 'Grade' },
      })
      const schoolClass = await db.schoolClass.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          name: 'A',
        },
      })
      const otherClass = await db.schoolClass.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          name: 'B',
        },
      })
      const subject = await db.subject.create({
        data: { schoolId: school.id, name: 'Math' },
      })
      await db.enrollment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: year.id,
          gradeLevelId: grade.id,
          schoolClassId: schoolClass.id,
          status: 'approved',
          approvedAt: new Date('2026-01-01'),
        },
      })
      for (const user of [teacher, unrelatedTeacher])
        await db.schoolMembership.create({
          data: {
            schoolId: school.id,
            userId: user.id,
            role: 'teacher',
            startsAt: new Date('2026-01-01'),
          },
        })
      const assignment = await db.teachingAssignment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          userId: teacher.id,
          startsAt: new Date('2026-01-01'),
        },
      })
      const otherAssignment = await db.teachingAssignment.create({
        data: {
          schoolId: school.id,
          academicYearId: year.id,
          schoolClassId: otherClass.id,
          subjectId: subject.id,
          userId: unrelatedTeacher.id,
          startsAt: new Date('2026-01-01'),
        },
      })
      const input = {
        schoolId: school.id,
        studentId: student.id,
        teachingAssignmentId: assignment.id,
        topic: 'Discuss the current coursework',
      }
      await expect(
        requestFamilyMeeting(db, studentUser.id, input),
      ).rejects.toBeInstanceOf(FamilyMeetingAccessError)
      await expect(
        requestFamilyMeeting(db, guardianUser.id, {
          ...input,
          teachingAssignmentId: otherAssignment.id,
        }),
      ).rejects.toBeInstanceOf(FamilyMeetingAccessError)
      const request = await requestFamilyMeeting(db, guardianUser.id, input)
      expect(request).toMatchObject({
        status: 'requested',
        guardianId: guardian.id,
        guardianUserId: guardianUser.id,
        teacherId: teacher.id,
        studentId: student.id,
      })
      const startsAt = new Date(Date.now() + 86400000)
      const endsAt = new Date(startsAt.getTime() + 1800000)
      const slot = await db.teacherMeetingAvailability.create({
        data: {
          schoolId: school.id,
          teacherId: teacher.id,
          startsAt,
          endsAt,
          method: 'inPerson',
        },
      })
      await expect(
        scheduleFamilyMeeting(db, unrelatedTeacher.id, {
          schoolId: school.id,
          requestId: request.id,
          availabilityId: slot.id,
          schoolLocation: 'School office',
        }),
      ).rejects.toBeInstanceOf(MeetingSchedulingError)
      const scheduled = await scheduleFamilyMeeting(db, teacher.id, {
        schoolId: school.id,
        requestId: request.id,
        availabilityId: slot.id,
        schoolLocation: 'School office',
      })
      expect(scheduled).toMatchObject({
        status: 'scheduled',
        scheduledStartAt: startsAt,
        scheduledEndAt: endsAt,
        meetingMethod: 'inPerson',
      })
      const second = await requestFamilyMeeting(db, guardianUser.id, input)
      await expect(
        scheduleFamilyMeeting(db, teacher.id, {
          schoolId: school.id,
          requestId: second.id,
          availabilityId: slot.id,
          schoolLocation: 'School office',
        }),
      ).rejects.toBeInstanceOf(MeetingSchedulingError)
      const laterStart = new Date(endsAt.getTime() + 3600000)
      const laterEnd = new Date(laterStart.getTime() + 1800000)
      const laterSlot = await db.teacherMeetingAvailability.create({
        data: {
          schoolId: school.id,
          teacherId: teacher.id,
          startsAt: laterStart,
          endsAt: laterEnd,
          method: 'inPerson',
        },
      })
      await scheduleFamilyMeeting(db, teacher.id, {
        schoolId: school.id,
        requestId: request.id,
        availabilityId: laterSlot.id,
        schoolLocation: 'School library',
      })
      const history = await listMeetingHistory(
        db,
        guardianUser.id,
        school.id,
        request.id,
      )
      expect(history.map((event) => event.kind)).toEqual([
        'requested',
        'scheduled',
        'rescheduled',
      ])
      expect(history[2]).toMatchObject({
        previousStartAt: startsAt,
        newStartAt: laterStart,
      })
      await cancelFamilyMeeting(
        db,
        guardianUser.id,
        school.id,
        second.id,
        'No longer needed',
      )
      await completeFamilyMeeting(db, teacher.id, school.id, request.id)
      expect(
        await db.meetingEvent.count({ where: { requestId: request.id } }),
      ).toBe(4)
      await db.studentGuardian.update({
        where: {
          studentId_guardianId: {
            studentId: student.id,
            guardianId: guardian.id,
          },
        },
        data: { verificationStatus: 'revoked', revokedAt: new Date() },
      })
      await expect(
        requestFamilyMeeting(db, guardianUser.id, input),
      ).rejects.toBeInstanceOf(FamilyMeetingAccessError)
      expect(
        await db.parentTeacherMeetingRequest.count({
          where: { schoolId: school.id },
        }),
      ).toBe(2)
    } finally {
      await db.notification.deleteMany({
        where: {
          userId: { in: [guardianUser.id, teacher.id, unrelatedTeacher.id] },
        },
      })
      await db.meetingEvent.deleteMany({
        where: { request: { schoolId: school.id } },
      })
      await db.parentTeacherMeetingRequest.deleteMany({
        where: { schoolId: school.id },
      })
      await db.teacherMeetingAvailability.deleteMany({
        where: { schoolId: school.id },
      })
      await db.teachingAssignment.deleteMany({ where: { schoolId: school.id } })
      await db.enrollment.deleteMany({ where: { schoolId: school.id } })
      await db.studentGuardian.deleteMany({ where: { studentId: student.id } })
      await db.guardianAccess.deleteMany({ where: { guardianId: guardian.id } })
      await db.studentAccess.deleteMany({ where: { studentId: student.id } })
      await db.schoolMembership.deleteMany({ where: { schoolId: school.id } })
      await db.subject.deleteMany({ where: { schoolId: school.id } })
      await db.schoolClass.deleteMany({ where: { schoolId: school.id } })
      await db.gradeLevel.deleteMany({ where: { schoolId: school.id } })
      await db.academicYear.deleteMany({ where: { schoolId: school.id } })
      await db.student.delete({ where: { id: student.id } })
      await db.guardian.delete({ where: { id: guardian.id } })
      await db.user.deleteMany({
        where: {
          id: {
            in: [
              guardianUser.id,
              studentUser.id,
              teacher.id,
              unrelatedTeacher.id,
            ],
          },
        },
      })
      await db.school.delete({ where: { id: school.id } })
      await db.organization.delete({ where: { id: organization.id } })
    }
  })
})
