import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'
import { expectAccessiblePage } from './accessibility.js'

test('guardian requests a school meeting and sees the teacher schedule', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'MeetingPassphrase123!'
  const teacherEmail = `meeting-teacher-${suffix}@example.test`
  const guardianEmail = `meeting-guardian-${suffix}@example.test`
  const otherEmail = `meeting-other-${suffix}@example.test`
  const organization = await database.organization.create({
    data: { name: `Meeting ${suffix}` },
  })
  const school = await database.school.create({
    data: { organizationId: organization.id, name: 'Meeting school' },
  })
  const hash = await hashPassword(password)
  const users = []
  for (const email of [teacherEmail, guardianEmail, otherEmail]) {
    users.push(
      await database.user.create({
        data: {
          email,
          displayName: email,
          passwordCredential: { create: { passwordHash: hash } },
        },
      }),
    )
  }
  const [teacher, guardianUser, otherUser] = users
  const guardian = await database.guardian.create({
    data: { name: 'Guardian' },
  })
  const otherGuardian = await database.guardian.create({
    data: { name: 'Other guardian' },
  })
  const student = await database.student.create({
    data: { studentReference: `MEET-${suffix}`, givenName: 'Sample' },
  })
  const otherStudent = await database.student.create({
    data: { studentReference: `MEET-OTHER-${suffix}`, givenName: 'Other' },
  })
  const year = new Date().getUTCFullYear()
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  }
  const signOut = async () => {
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  }
  try {
    await database.schoolMembership.create({
      data: {
        schoolId: school.id,
        userId: teacher!.id,
        role: 'teacher',
        startsAt: new Date(`${year}-01-01`),
      },
    })
    await database.guardianAccess.createMany({
      data: [
        { userId: guardianUser!.id, guardianId: guardian.id },
        { userId: otherUser!.id, guardianId: otherGuardian.id },
      ],
    })
    await database.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: 'parent',
        verificationStatus: 'verified',
        verificationSchoolId: school.id,
        verifiedAt: new Date(),
      },
    })
    await database.studentGuardian.create({
      data: {
        studentId: otherStudent.id,
        guardianId: otherGuardian.id,
        relationship: 'parent',
        verificationStatus: 'verified',
        verificationSchoolId: school.id,
        verifiedAt: new Date(),
      },
    })
    await database.schoolServiceAccess.create({
      data: {
        schoolId: school.id,
        parentPortalEnabled: true,
        enabledAt: new Date(),
      },
    })
    const academicYear = await database.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Current year',
        startsOn: new Date(`${year}-01-01`),
        endsOn: new Date(`${year + 1}-12-31`),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade 6' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        name: 'A',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId: school.id, name: 'Science' },
    })
    await database.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
        approvedAt: new Date(`${year}-01-01`),
      },
    })
    await database.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: otherStudent.id,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
        approvedAt: new Date(`${year}-01-01`),
      },
    })
    const assignment = await database.teachingAssignment.create({
      data: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        userId: teacher!.id,
        startsAt: new Date(`${year}-01-01`),
      },
    })
    await signIn(guardianEmail)
    await page.getByRole('button', { name: 'Meetings' }).click()
    await expect(
      page.getByRole('heading', { name: 'Family meetings for Sample' }),
    ).toBeVisible()
    await expectAccessiblePage(page)
    await page.getByLabel('Current teacher').selectOption(assignment.id)
    await expect(page.getByRole('option', { name: /Science/ })).toHaveCount(1)
    await page.getByLabel('Topic').fill('Discuss classroom learning')
    await page.getByRole('button', { name: 'Request meeting' }).click()
    await expect(page.getByText('Meeting requested.')).toBeVisible()
    const request = await database.parentTeacherMeetingRequest.findFirstOrThrow(
      { where: { schoolId: school.id, guardianUserId: guardianUser!.id } },
    )
    await signOut()
    await signIn(teacherEmail)
    const startsAt = new Date(Date.now() + 86400000)
    const endsAt = new Date(startsAt.getTime() + 1800000)
    const created = await page.request.post(
      `/api/schools/${school.id}/meetings/availability`,
      {
        data: {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          method: 'inPerson',
        },
      },
    )
    expect(created.status()).toBe(201)
    const slot = (await created.json()) as { id: string }
    const scheduled = await page.request.post(
      `/api/schools/${school.id}/meetings/${request.id}/schedule`,
      { data: { availabilityId: slot.id, schoolLocation: 'School office' } },
    )
    expect(scheduled.status()).toBe(200)
    await signOut()
    await signIn(guardianEmail)
    await page.getByRole('button', { name: 'Meetings' }).click()
    await expect(page.getByText('Discuss classroom learning')).toBeVisible()
    await expect(page.getByText(/School office/)).toBeVisible()
    const history = await page.request.get(
      `/api/parent/schools/${school.id}/meetings/${request.id}/history`,
    )
    expect(history.status()).toBe(200)
    expect(
      ((await history.json()) as { events: { kind: string }[] }).events.map(
        (event) => event.kind,
      ),
    ).toEqual(['requested', 'scheduled'])
    await signOut()
    await signIn(otherEmail)
    const unrelated = await page.request.post(
      `/api/parent/schools/${school.id}/meetings`,
      {
        data: {
          studentId: student.id,
          teachingAssignmentId: assignment.id,
          topic: 'Unrelated request',
        },
      },
    )
    expect(unrelated.status()).toBe(404)
  } finally {
    const userIds = users.map((user) => user.id)
    await database.notification.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.meetingEvent.deleteMany({
      where: { request: { schoolId: school.id } },
    })
    await database.parentTeacherMeetingRequest.deleteMany({
      where: { schoolId: school.id },
    })
    await database.teacherMeetingAvailability.deleteMany({
      where: { schoolId: school.id },
    })
    await database.teachingAssignment.deleteMany({
      where: { schoolId: school.id },
    })
    await database.enrollment.deleteMany({ where: { schoolId: school.id } })
    await database.studentGuardian.deleteMany({
      where: { studentId: { in: [student.id, otherStudent.id] } },
    })
    await database.guardianAccess.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.schoolMembership.deleteMany({
      where: { schoolId: school.id },
    })
    await database.subject.deleteMany({ where: { schoolId: school.id } })
    await database.schoolClass.deleteMany({ where: { schoolId: school.id } })
    await database.gradeLevel.deleteMany({ where: { schoolId: school.id } })
    await database.academicYear.deleteMany({ where: { schoolId: school.id } })
    await database.schoolServiceAccess.deleteMany({
      where: { schoolId: school.id },
    })
    await database.session.deleteMany({ where: { userId: { in: userIds } } })
    await database.passwordCredential.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.student.deleteMany({
      where: { id: { in: [student.id, otherStudent.id] } },
    })
    await database.guardian.deleteMany({
      where: { id: { in: [guardian.id, otherGuardian.id] } },
    })
    await database.user.deleteMany({ where: { id: { in: userIds } } })
    await database.school.delete({ where: { id: school.id } })
    await database.organization.delete({ where: { id: organization.id } })
    await database.$disconnect()
  }
})
