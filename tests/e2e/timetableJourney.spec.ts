import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('administrator publishes a class timetable and teacher sees only assigned lessons', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'TimetablePassphrase123!'
  const adminEmail = `timetable-admin-${suffix}@example.test`
  const teacherEmail = `timetable-teacher-${suffix}@example.test`
  let organizationId = '',
    schoolId = '',
    yearId = '',
    gradeId = '',
    subjectId = ''
  const userIds: string[] = []
  try {
    const organization = await database.organization.create({
      data: { name: `Timetable ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Timetable school' },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Timetable Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Timetable Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    userIds.push(admin.id, teacher.id)
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Timetable year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    yearId = year.id
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Grade 7' },
    })
    gradeId = grade.id
    const firstClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: yearId,
        gradeLevelId: gradeId,
        name: 'A',
      },
    })
    const secondClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: yearId,
        gradeLevelId: gradeId,
        name: 'B',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Mathematics' },
    })
    subjectId = subject.id
    await database.teachingAssignment.create({
      data: {
        schoolId,
        academicYearId: yearId,
        schoolClassId: firstClass.id,
        subjectId,
        userId: teacher.id,
        startsAt: new Date('2026-01-01'),
      },
    })
    await database.teachingAssignment.create({
      data: {
        schoolId,
        academicYearId: yearId,
        schoolClassId: secondClass.id,
        subjectId,
        userId: teacher.id,
        startsAt: new Date('2026-01-01'),
      },
    })
    const period = await database.timetablePeriod.create({
      data: {
        schoolId,
        name: 'Morning lesson',
        startTime: '08:00',
        endTime: '08:45',
        sortOrder: 1,
        instructional: true,
      },
    })
    const firstAssignment = await database.teachingAssignment.findFirstOrThrow({
      where: { schoolId, schoolClassId: firstClass.id, userId: teacher.id },
      select: { id: true },
    })
    const plan = await database.classTimetable.create({
      data: { schoolId, academicYearId: yearId, schoolClassId: firstClass.id },
    })
    await database.classTimetableEntry.create({
      data: {
        timetableId: plan.id,
        schoolId,
        academicYearId: yearId,
        schoolClassId: firstClass.id,
        subjectId,
        teachingAssignmentId: firstAssignment.id,
        timetablePeriodId: period.id,
        weekday: 1,
      },
    })
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(adminEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    const published = await page.evaluate(
      async (path) =>
        (await fetch(path, { method: 'POST', credentials: 'include' })).status,
      `/api/schools/${schoolId}/timetables/${plan.id}/publish`,
    )
    expect(published).toBe(200)
    const conflictingPlan = await database.classTimetable.create({
      data: { schoolId, academicYearId: yearId, schoolClassId: secondClass.id },
    })
    const conflictingAssignment =
      await database.teachingAssignment.findFirstOrThrow({
        where: { schoolId, schoolClassId: secondClass.id, userId: teacher.id },
        select: { id: true },
      })
    const conflict = await page.evaluate(
      async ({ path, body }) => {
        const response = await fetch(path, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        return response.status
      },
      {
        path: `/api/schools/${schoolId}/timetables/${conflictingPlan.id}/entries`,
        body: {
          subjectId,
          teachingAssignmentId: conflictingAssignment.id,
          timetablePeriodId: period.id,
          weekday: 1,
        },
      },
    )
    expect(conflict).toBe(409)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email', { exact: true }).fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    const teacherPanel = page.getByRole('region', { name: 'My timetable' })
    await expect(teacherPanel).toBeVisible()
    await teacherPanel.getByRole('button', { name: 'Week' }).click()
    await expect(teacherPanel.getByText('Mathematics')).toBeVisible()
    await expect(teacherPanel.getByText('A', { exact: true })).toBeVisible()
    await expect(teacherPanel.getByText('B', { exact: true })).toHaveCount(0)
  } finally {
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
    if (schoolId) await database.schoolClass.deleteMany({ where: { schoolId } })
    if (gradeId) await database.gradeLevel.delete({ where: { id: gradeId } })
    if (yearId) await database.academicYear.delete({ where: { id: yearId } })
    if (schoolId) await database.school.delete({ where: { id: schoolId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
