import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('teacher captures attendance and student sees only finalized history', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'AttendancePassphrase123!'
  const teacherEmail = `attendance-teacher-${suffix}@example.test`
  const adminEmail = `attendance-admin-${suffix}@example.test`
  const studentEmail = `attendance-student-${suffix}@example.test`
  const otherEmail = `attendance-other-${suffix}@example.test`
  const userIds: string[] = []
  const studentIds: string[] = []
  let organizationId = '',
    schoolId = '',
    yearId = '',
    gradeId = '',
    classId = '',
    otherClassId = '',
    subjectId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Attendance ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Attendance school' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Attendance Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: {
          create: {
            schoolId,
            role: 'teacher',
            startsAt: new Date('2026-01-01'),
          },
        },
      },
    })
    userIds.push(teacher.id)
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Attendance Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: {
          create: {
            schoolId,
            role: 'administrator',
            startsAt: new Date('2026-01-01'),
          },
        },
      },
    })
    userIds.push(admin.id)
    const other = await database.user.create({
      data: {
        email: otherEmail,
        displayName: 'Other Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: {
          create: {
            schoolId,
            role: 'teacher',
            startsAt: new Date('2026-01-01'),
          },
        },
      },
    })
    userIds.push(other.id)
    const studentUser = await database.user.create({
      data: {
        email: studentEmail,
        displayName: 'Ada Student',
        passwordCredential: { create: { passwordHash } },
      },
    })
    userIds.push(studentUser.id)
    const currentYear = new Date().getFullYear()
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Attendance year',
        startsOn: new Date(`${currentYear}-01-01`),
        endsOn: new Date(`${currentYear}-12-31`),
      },
    })
    yearId = year.id
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Grade 7' },
    })
    gradeId = grade.id
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: yearId,
        gradeLevelId: gradeId,
        name: 'A',
      },
    })
    classId = schoolClass.id
    const otherClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: yearId,
        gradeLevelId: gradeId,
        name: 'B',
      },
    })
    otherClassId = otherClass.id
    const subject = await database.subject.create({
      data: { schoolId, name: 'Mathematics' },
    })
    subjectId = subject.id
    const assignment = await database.teachingAssignment.create({
      data: {
        schoolId,
        academicYearId: yearId,
        schoolClassId: classId,
        subjectId,
        userId: teacher.id,
        startsAt: new Date(`${currentYear}-01-01`),
      },
    })
    await database.teachingAssignment.create({
      data: {
        schoolId,
        academicYearId: yearId,
        schoolClassId: otherClassId,
        subjectId,
        userId: other.id,
        startsAt: new Date(`${currentYear}-01-01`),
      },
    })
    const period = await database.timetablePeriod.create({
      data: {
        schoolId,
        name: 'Morning',
        startTime: '08:00',
        endTime: '08:45',
        sortOrder: 1,
        instructional: true,
      },
    })
    const plan = await database.classTimetable.create({
      data: {
        schoolId,
        academicYearId: yearId,
        schoolClassId: classId,
        status: 'published',
        publishedAt: new Date(),
      },
    })
    await database.classTimetableEntry.create({
      data: {
        timetableId: plan.id,
        schoolId,
        academicYearId: yearId,
        schoolClassId: classId,
        subjectId,
        teachingAssignmentId: assignment.id,
        timetablePeriodId: period.id,
        weekday: ((new Date().getDay() + 6) % 7) + 1,
      },
    })
    for (const name of ['Ada', 'Ben', 'Cora']) {
      const student = await database.student.create({
        data: {
          studentReference: `${name}-${suffix}`,
          givenName: name,
          familyName: 'Test',
        },
      })
      studentIds.push(student.id)
      await database.enrollment.create({
        data: {
          studentId: student.id,
          schoolId,
          academicYearId: yearId,
          gradeLevelId: gradeId,
          schoolClassId: classId,
          status: 'approved',
        },
      })
    }
    await database.studentAccess.create({
      data: { userId: studentUser.id, studentId: studentIds[0]! },
    })
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    const panel = page.getByRole('region', { name: 'Daily attendance' })
    await expect(panel).toBeVisible()
    await panel
      .getByLabel('Assigned class')
      .selectOption(
        (await panel
          .getByRole('option', { name: /Mathematics/ })
          .getAttribute('value'))!,
      )
    const openResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/attendance/sessions') &&
        response.request().method() === 'POST',
    )
    await panel.getByRole('button', { name: 'Open attendance session' }).click()
    const opened = await openResponse
    expect(opened.status(), await opened.text()).toBe(200)
    await expect(panel.getByText('Unrecorded: 3')).toBeVisible()
    await panel.getByRole('button', { name: 'Submit attendance' }).click()
    await expect(panel.getByRole('alert')).toContainText('unrecorded')
    await panel.getByLabel('Status for Ada').selectOption('present')
    await panel.getByLabel('Status for Ben').selectOption('absent')
    await panel.getByLabel('Status for Cora').selectOption('late')
    await panel.getByRole('button', { name: 'Submit attendance' }).click()
    await expect(panel.getByText('Attendance submitted.')).toBeVisible()
    const sessions = await database.attendanceSession.findMany({
      where: { schoolId },
    })
    expect(sessions).toHaveLength(1)
    const sessionId = sessions[0]!.id
    const denied = await page.request.put(
      `http://127.0.0.1:4173/api/schools/${schoolId}/attendance/sessions/${sessionId}/records/bulk`,
      {
        data: {
          marks: [
            {
              studentId: studentIds[0],
              enrollmentId: randomUUID(),
              status: 'absent',
            },
          ],
        },
      },
    )
    expect(denied.status()).toBe(409)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email', { exact: true }).fill(otherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    const crossClass = await page.evaluate(
      async (path) => (await fetch(path, { credentials: 'include' })).status,
      `/api/schools/${schoolId}/attendance/sessions/${sessionId}/roster`,
    )
    expect(crossClass).toBe(403)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email', { exact: true }).fill(adminEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    const finalized = await page.evaluate(
      async (path) =>
        (await fetch(path, { method: 'POST', credentials: 'include' })).status,
      `/api/schools/${schoolId}/attendance/sessions/${sessionId}/finalize`,
    )
    expect(finalized).toBe(200)
    const counts = await page.evaluate(
      async (path) =>
        (await (await fetch(path, { credentials: 'include' })).json()) as {
          present: number
          absent: number
        },
      `/api/schools/${schoolId}/attendance/classes/${classId}/summary?academicYearId=${yearId}`,
    )
    expect(counts.present).toBe(1)
    expect(counts.absent).toBe(1)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email', { exact: true }).fill(studentEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Attendance' })).toBeVisible()
    await page.getByRole('button', { name: 'Attendance' }).click()
    await expect(
      page
        .getByRole('region', { name: 'Attendance history' })
        .getByText('present'),
    ).toBeVisible()
  } finally {
    await database.attendanceCorrection.deleteMany({
      where: { record: { schoolId } },
    })
    await database.studentAttendanceRecord.deleteMany({ where: { schoolId } })
    await database.attendanceSession.deleteMany({ where: { schoolId } })
    await database.enrollment.deleteMany({ where: { schoolId } })
    await database.studentAccess.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.student.deleteMany({ where: { id: { in: studentIds } } })
    await database.classTimetableEntry.deleteMany({ where: { schoolId } })
    await database.classTimetable.deleteMany({ where: { schoolId } })
    await database.timetablePeriod.deleteMany({ where: { schoolId } })
    await database.teachingAssignment.deleteMany({ where: { schoolId } })
    await database.auditEvent.deleteMany({
      where: { actorUserId: { in: userIds } },
    })
    await database.session.deleteMany({ where: { userId: { in: userIds } } })
    await database.schoolMembership.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.user.deleteMany({ where: { id: { in: userIds } } })
    if (subjectId) await database.subject.delete({ where: { id: subjectId } })
    if (classId || otherClassId)
      await database.schoolClass.deleteMany({ where: { schoolId } })
    if (gradeId) await database.gradeLevel.delete({ where: { id: gradeId } })
    if (yearId) await database.academicYear.delete({ where: { id: yearId } })
    if (schoolId) await database.school.delete({ where: { id: schoolId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
