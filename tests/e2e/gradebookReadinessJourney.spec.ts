import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('teacher gradebook, moderation history, lock readiness and assignment boundary', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'GradebookPassphrase123!'
  const schoolId = randomUUID()
  const organizationId = randomUUID()
  const userIds: string[] = []
  const studentIds: string[] = []
  const year = new Date().getUTCFullYear()
  const adminEmail = `gradebook-admin-${suffix}@example.test`
  const teacherEmail = `gradebook-teacher-${suffix}@example.test`
  const otherEmail = `gradebook-other-${suffix}@example.test`
  const post = async (path: string, body?: unknown) =>
    page.evaluate(
      async ({ path, body }) => {
        const response = await fetch(path, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'x-csrf-token': decodeURIComponent(
              document.cookie.match(/(?:^|; )warka_csrf=([^;]+)/)?.[1] ?? '',
            ),
            ...(body === undefined
              ? {}
              : { 'content-type': 'application/json' }),
          },
          ...(body === undefined
            ? {}
            : {
                body: JSON.stringify(body),
              }),
        })
        const text = await response.text()
        return {
          status: response.status,
          value: text ? (JSON.parse(text) as Record<string, unknown>) : {},
        }
      },
      { path, body },
    )
  const get = async (path: string) =>
    page.evaluate(async (path) => {
      const response = await fetch(path, { credentials: 'include' })
      const text = await response.text()
      return {
        status: response.status,
        value: text ? (JSON.parse(text) as Record<string, unknown>) : {},
      }
    }, path)
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  }
  try {
    await database.organization.create({
      data: { id: organizationId, name: `Gradebook ${suffix}` },
    })
    await database.school.create({
      data: { id: schoolId, organizationId, name: 'Gradebook school' },
    })
    const passwordHash = await hashPassword(password)
    for (const [email, role] of [
      [adminEmail, 'administrator'],
      [teacherEmail, 'teacher'],
      [otherEmail, 'teacher'],
    ] as const) {
      const user = await database.user.create({
        data: {
          email,
          displayName: email,
          passwordCredential: { create: { passwordHash } },
          schoolMemberships: {
            create: { schoolId, role, startsAt: new Date(`${year}-01-01`) },
          },
        },
      })
      userIds.push(user.id)
    }
    const teacherId = userIds[1]!
    const academicYear = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Gradebook year',
        startsOn: new Date(`${year}-01-01`),
        endsOn: new Date(`${year}-12-31`),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Grade 7' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        name: 'A',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Mathematics' },
    })
    const period = await database.gradingPeriod.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        name: 'Term',
        startsOn: new Date(`${year}-01-01`),
        endsOn: new Date(`${year}-12-31`),
      },
    })
    const scheme = await database.gradingScheme.create({ data: { schoolId } })
    await database.gradeBand.create({
      data: {
        gradingSchemeId: scheme.id,
        label: 'Pass',
        minimumPercentage: '0',
      },
    })
    const assessment = await database.assessment.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        name: 'Quiz',
        maximumScore: '20',
        weight: '100',
        position: 0,
      },
    })
    await database.teachingAssignment.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        userId: teacherId,
        startsAt: new Date(`${year}-01-01`),
      },
    })
    const enrollments = []
    for (const reference of ['GB-ONE', 'GB-TWO']) {
      const student = await database.student.create({
        data: {
          studentReference: `${reference}-${suffix}`,
          givenName: reference,
        },
      })
      studentIds.push(student.id)
      enrollments.push(
        await database.enrollment.create({
          data: {
            studentId: student.id,
            schoolId,
            academicYearId: academicYear.id,
            gradeLevelId: grade.id,
            schoolClassId: schoolClass.id,
            status: 'approved',
          },
        }),
      )
    }
    const schedule = await database.assessmentSchedule.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        assessmentId: assessment.id,
        scheduledDate: new Date(`${year}-10-10`),
        startTime: '09:00',
        endTime: '10:00',
        status: 'scheduled',
      },
    })
    const session = await database.assessmentSession.create({
      data: {
        schoolId,
        scheduleId: schedule.id,
        schoolClassId: schoolClass.id,
        sessionDate: new Date(`${year}-10-10`),
        startTime: '09:00',
        endTime: '10:00',
        status: 'completed',
      },
    })
    await database.assessmentParticipation.create({
      data: {
        schoolId,
        sessionId: session.id,
        studentId: studentIds[0],
        enrollmentId: enrollments[0].id,
        academicYearId: academicYear.id,
        schoolClassId: schoolClass.id,
        status: 'present',
        recordedById: teacherId,
      },
    })
    const base = `/api/schools/${schoolId}`
    const context = {
      academicYearId: academicYear.id,
      gradingPeriodId: period.id,
      schoolClassId: schoolClass.id,
      subjectId: subject.id,
    }
    await signIn(adminEmail)
    const window = await post(`${base}/gradebook/windows`, {
      assessmentId: assessment.id,
      opensAt: new Date(Date.now() - 3600000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
    })
    expect(window.status).toBe(201)
    expect(
      (await post(`${base}/gradebook/windows/${window.value.id}/open`)).status,
    ).toBe(200)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(teacherEmail)
    const gradebook = page.getByRole('region', { name: 'Gradebook controls' })
    await expect(gradebook).toBeVisible()
    await expect(gradebook.getByText('Not recorded')).toBeVisible()
    await expect(gradebook.getByText('Missing mark').first()).toBeVisible()
    await gradebook.getByLabel(`Score for ${'GB-ONE-' + suffix}`).fill('10')
    await gradebook.getByRole('button', { name: 'Save mark' }).first().click()
    await expect(
      gradebook.getByText('Recorded mark: 10.00 / 20.00'),
    ).toBeVisible()
    const firstMark = await database.mark.findFirstOrThrow({
      where: { assessmentId: assessment.id, enrollmentId: enrollments[0].id },
    })
    const moderation = await post(`${base}/gradebook/moderation`, {
      markId: firstMark.id,
      proposedScore: '12',
      reason: 'Verified marking correction',
    })
    expect(moderation.status).toBe(201)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(otherEmail)
    expect(
      (
        await post(`${base}/marks`, {
          assessmentId: assessment.id,
          enrollmentId: enrollments[1].id,
          score: '8',
        })
      ).status,
    ).toBe(404)
    expect(
      (await get(`${base}/gradebook?${new URLSearchParams(context)}`)).status,
    ).toBe(403)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(adminEmail)
    expect((await post(`${base}/gradebook/lock`, context)).status).toBe(409)
    expect(
      (
        await post(
          `${base}/gradebook/moderation/${moderation.value.id}/review`,
          { decision: 'approved' },
        )
      ).status,
    ).toBe(200)
    const correction = await database.markCorrection.findFirstOrThrow({
      where: { moderationRequestId: moderation.value.id as string },
    })
    expect(correction.previousScore.toFixed(2)).toBe('10.00')
    expect(correction.newScore.toFixed(2)).toBe('12.00')
    expect(
      (
        await database.mark.findUniqueOrThrow({ where: { id: firstMark.id } })
      ).score.toFixed(2),
    ).toBe('12.00')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(teacherEmail)
    await expect(gradebook.getByText('Missing mark').first()).toBeVisible()
    await gradebook.getByLabel(`Score for ${'GB-TWO-' + suffix}`).fill('0')
    await gradebook.getByRole('button', { name: 'Save mark' }).last().click()
    await expect(
      gradebook.getByText('Recorded zero: 0.00 / 20.00'),
    ).toBeVisible()
    expect((await post(`${base}/results/submit`, context)).status).toBe(200)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(adminEmail)
    expect(
      (await post(`${base}/gradebook/windows/${window.value.id}/close`)).status,
    ).toBe(200)
    expect((await post(`${base}/gradebook/lock`, context)).status).toBe(200)
    const readiness = await get(
      `${base}/gradebook/readiness?${new URLSearchParams(context)}`,
    )
    expect(readiness.status).toBe(200)
    expect(readiness.value.ready).toBe(true)
    expect(readiness.value.resultStatus).toBe('pending')
    expect(await database.publishedResult.count({ where: { schoolId } })).toBe(
      0,
    )
  } finally {
    await database.gradebookLockEvent.deleteMany({
      where: { lock: { schoolId } },
    })
    await database.gradebookLock.deleteMany({ where: { schoolId } })
    await database.markCorrection.deleteMany({ where: { schoolId } })
    await database.markModerationRequest.deleteMany({ where: { schoolId } })
    await database.mark.deleteMany({ where: { schoolId } })
    await database.markEntryWindow.deleteMany({ where: { schoolId } })
    await database.assessmentParticipation.deleteMany({ where: { schoolId } })
    await database.assessmentSession.deleteMany({ where: { schoolId } })
    await database.assessmentSchedule.deleteMany({ where: { schoolId } })
    await database.assessment.deleteMany({ where: { schoolId } })
    await database.resultSet.deleteMany({ where: { schoolId } })
    await database.enrollment.deleteMany({ where: { schoolId } })
    await database.gradingPeriod.deleteMany({ where: { schoolId } })
    await database.teachingAssignment.deleteMany({ where: { schoolId } })
    await database.subject.deleteMany({ where: { schoolId } })
    await database.schoolClass.deleteMany({ where: { schoolId } })
    await database.gradeLevel.deleteMany({ where: { schoolId } })
    await database.gradingScheme.deleteMany({ where: { schoolId } })
    await database.academicYear.deleteMany({ where: { schoolId } })
    await database.auditEvent.deleteMany({
      where: { actorUserId: { in: userIds } },
    })
    await database.session.deleteMany({ where: { userId: { in: userIds } } })
    await database.schoolMembership.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.user.deleteMany({ where: { id: { in: userIds } } })
    await database.student.deleteMany({ where: { id: { in: studentIds } } })
    await database.school.deleteMany({ where: { id: schoolId } })
    await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
