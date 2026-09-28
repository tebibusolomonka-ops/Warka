import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('assessment scheduling blocks collisions and preserves absence through make-up review', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'AssessmentPassphrase123!'
  const adminEmail = `assessment-admin-${suffix}@example.test`
  const teacherEmail = `assessment-teacher-${suffix}@example.test`
  const schoolId = randomUUID()
  const organizationId = randomUUID()
  const userIds: string[] = []
  const studentIds: string[] = []
  const year = new Date().getUTCFullYear()
  const scheduleDate = `${year}-10-10`
  const post = async (path: string, body?: unknown) =>
    page.evaluate(
      async ({ path, body }) => {
        const response = await fetch(path, {
          method: 'POST',
          credentials: 'include',
          ...(body === undefined
            ? {}
            : {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
              }),
        })
        return {
          status: response.status,
          value: (await response.json()) as Record<string, unknown>,
        }
      },
      { path, body },
    )
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  }
  try {
    await database.organization.create({
      data: { id: organizationId, name: `Assessment ${suffix}` },
    })
    await database.school.create({
      data: { id: schoolId, organizationId, name: 'Assessment school' },
    })
    const passwordHash = await hashPassword(password)
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Assessment Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: {
          create: {
            schoolId,
            role: 'administrator',
            startsAt: new Date(`${year}-01-01`),
          },
        },
      },
    })
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Assessment Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: {
          create: {
            schoolId,
            role: 'teacher',
            startsAt: new Date(`${year}-01-01`),
          },
        },
      },
    })
    const expired = await database.user.create({
      data: {
        email: `assessment-expired-${suffix}@example.test`,
        displayName: 'Expired Staff',
        schoolMemberships: {
          create: {
            schoolId,
            role: 'teacher',
            startsAt: new Date(`${year}-01-01`),
            endsAt: new Date(`${year}-09-01`),
          },
        },
      },
    })
    userIds.push(admin.id, teacher.id, expired.id)
    const academicYear = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Assessment year',
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
    const otherClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        name: 'B',
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
    const otherAssessment = await database.assessment.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradingPeriodId: period.id,
        schoolClassId: otherClass.id,
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
        userId: teacher.id,
        startsAt: new Date(`${year}-01-01`),
      },
    })
    const student = await database.student.create({
      data: {
        studentReference: `AS-${suffix}`,
        givenName: 'Synthetic Student',
      },
    })
    studentIds.push(student.id)
    await database.enrollment.create({
      data: {
        studentId: student.id,
        schoolId,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
      },
    })
    await signIn(adminEmail)
    await expect(
      page.getByRole('region', { name: 'Assessment calendar' }),
    ).toBeVisible()
    const base = `/api/schools/${schoolId}`
    const room = await post(`${base}/assessment-rooms`, {
      name: 'Hall',
      code: 'H1',
      capacity: 1,
    })
    expect(room.status).toBe(201)
    const input = {
      academicYearId: academicYear.id,
      gradingPeriodId: period.id,
      schoolClassId: schoolClass.id,
      subjectId: subject.id,
      assessmentId: assessment.id,
      roomId: room.value.id,
      scheduledDate: scheduleDate,
      startTime: '09:00',
      endTime: '10:00',
    }
    const draft = await post(`${base}/assessment-schedules`, input)
    expect(draft.status).toBe(201)
    const validation = await page.evaluate(
      async (path) =>
        (await (await fetch(path, { credentials: 'include' })).json()) as {
          valid: boolean
        },
      `${base}/assessment-schedules/${draft.value.id}/validation`,
    )
    expect(validation.valid).toBe(true)
    expect(
      (await post(`${base}/assessment-schedules/${draft.value.id}/schedule`))
        .status,
    ).toBe(200)
    const blocked = await post(`${base}/assessment-schedules`, {
      ...input,
      schoolClassId: otherClass.id,
      assessmentId: otherAssessment.id,
    })
    expect(blocked.status).toBe(201)
    const blockedValidation = await page.evaluate(
      async (path) =>
        (await (await fetch(path, { credentials: 'include' })).json()) as {
          issues: { code: string }[]
        },
      `${base}/assessment-schedules/${blocked.value.id}/validation`,
    )
    expect(blockedValidation.issues.map((issue) => issue.code)).toContain(
      'ROOM_COLLISION',
    )
    expect(
      (await post(`${base}/assessment-schedules/${blocked.value.id}/schedule`))
        .status,
    ).toBe(409)
    const session = await post(
      `${base}/assessment-schedules/${draft.value.id}/session`,
    )
    expect(session.status).toBe(201)
    expect(
      (
        await post(
          `${base}/assessment-sessions/${session.value.id}/invigilators`,
          { userId: expired.id },
        )
      ).status,
    ).toBe(409)
    expect(
      (
        await post(
          `${base}/assessment-sessions/${session.value.id}/invigilators`,
          { userId: teacher.id },
        )
      ).status,
    ).toBe(201)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(teacherEmail)
    expect(
      (await post(`${base}/assessment-sessions/${session.value.id}/open`))
        .status,
    ).toBe(200)
    const participation = await post(
      `${base}/assessment-sessions/${session.value.id}/participation`,
      { studentId: student.id, status: 'absent' },
    )
    expect(participation.status).toBe(201)
    expect(
      await database.mark.count({ where: { assessmentId: assessment.id } }),
    ).toBe(0)
    expect(
      (await post(`${base}/assessment-sessions/${session.value.id}/complete`))
        .status,
    ).toBe(200)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(adminEmail)
    const makeUp = await post(`${base}/make-up-assessments`, {
      originalParticipationId: participation.value.id,
      reason: 'Documented medical absence',
    })
    expect(makeUp.status).toBe(201)
    expect(
      (
        await post(`${base}/make-up-assessments/${makeUp.value.id}/review`, {
          decision: 'approved',
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await database.assessmentParticipation.findUniqueOrThrow({
          where: { id: participation.value.id as string },
        })
      ).status,
    ).toBe('absent')
    expect(
      await database.mark.count({ where: { assessmentId: assessment.id } }),
    ).toBe(0)
  } finally {
    await database.assessmentInvigilation.deleteMany({ where: { schoolId } })
    await database.makeUpAssessment.deleteMany({ where: { schoolId } })
    await database.assessmentParticipation.deleteMany({ where: { schoolId } })
    await database.assessmentSession.deleteMany({ where: { schoolId } })
    await database.assessmentSchedule.deleteMany({ where: { schoolId } })
    await database.assessmentRoom.deleteMany({ where: { schoolId } })
    await database.assessment.deleteMany({ where: { schoolId } })
    await database.enrollment.deleteMany({ where: { schoolId } })
    await database.gradingPeriod.deleteMany({ where: { schoolId } })
    await database.teachingAssignment.deleteMany({ where: { schoolId } })
    await database.subject.deleteMany({ where: { schoolId } })
    await database.schoolClass.deleteMany({ where: { schoolId } })
    await database.gradeLevel.deleteMany({ where: { schoolId } })
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
