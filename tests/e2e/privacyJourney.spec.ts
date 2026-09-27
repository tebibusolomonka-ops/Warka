import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('student requests access, administrator fulfills, and teacher cannot review', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000)
  const suffix = randomUUID()
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const password = 'PrivacyPassphrase123!'
  const studentEmail = `privacy-student-${suffix}@example.test`
  const adminEmail = `privacy-admin-${suffix}@example.test`
  const teacherEmail = `privacy-teacher-${suffix}@example.test`
  let organizationId = '',
    schoolId = '',
    studentId = ''
  const users: string[] = []
  async function signIn(email: string) {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  try {
    const organization = await database.organization.create({
      data: { name: `Privacy Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { name: 'Privacy School', organizationId },
    })
    schoolId = school.id
    const student = await database.student.create({
      data: { studentReference: `PRIV-${suffix}`, givenName: 'Hana' },
    })
    studentId = student.id
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Grade' },
    })
    await database.enrollment.create({
      data: {
        schoolId,
        studentId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        status: 'approved',
      },
    })
    const passwordHash = await hashPassword(password)
    const studentUser = await database.user.create({
      data: {
        email: studentEmail,
        displayName: 'Hana',
        passwordCredential: { create: { passwordHash } },
        studentAccess: { create: { studentId } },
      },
    })
    users.push(studentUser.id)
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Privacy Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    users.push(admin.id)
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Privacy Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    users.push(teacher.id)
    await signIn(studentEmail)
    await page
      .getByRole('form', { name: 'Submit data request' })
      .getByLabel('Details')
      .fill('Please provide my school records')
    await page.getByRole('button', { name: 'Submit request' }).click()
    await expect(
      page
        .getByLabel('My data requests')
        .locator('li')
        .filter({ hasText: 'access · submitted' }),
    ).toBeVisible()
    const request = await database.privacyRequest.findFirstOrThrow({
      where: { requesterUserId: studentUser.id },
    })
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await signIn(teacherEmail)
    await expect(page.getByText('Signed in as Privacy Teacher')).toBeVisible()
    const denied = await context.request.get(
      `/api/schools/${schoolId}/privacy/requests`,
    )
    expect(denied.status()).toBe(403)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await signIn(adminEmail)
    await page
      .getByLabel('Privacy request review')
      .getByRole('button', { name: 'Approve' })
      .click()
    await expect(
      page
        .getByLabel('Privacy request review')
        .getByRole('button', { name: 'Prepare access package' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Prepare access package' }).click()
    await expect
      .poll(
        async () =>
          (
            await database.privacyRequest.findUniqueOrThrow({
              where: { id: request.id },
            })
          ).status,
      )
      .toBe('fulfilled')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await signIn(studentEmail)
    await page.getByRole('button', { name: 'View access package' }).click()
    await expect(page.getByLabel('Access package')).toContainText('Hana')
    const form = page.getByRole('form', { name: 'Submit data request' })
    await form.getByLabel('Request type').selectOption('correction')
    await form.getByLabel('Official field').selectOption('givenName')
    await form.getByLabel('Proposed value').fill('Hanna')
    await form.getByLabel('Details').fill('Correct the spelling of my name')
    await form.getByRole('button', { name: 'Submit request' }).click()
    await expect
      .poll(async () =>
        database.privacyRequest.findFirst({
          where: { requesterUserId: studentUser.id, type: 'correction' },
        }),
      )
      .not.toBeNull()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await signIn(adminEmail)
    await page
      .getByLabel('Privacy request review')
      .getByRole('button', { name: 'Approve' })
      .click()
    await expect
      .poll(
        async () =>
          (
            await database.privacyRequest.findFirstOrThrow({
              where: { requesterUserId: studentUser.id, type: 'correction' },
            })
          ).officialCorrectionRequestId,
      )
      .not.toBeNull()
    const routed = await database.privacyRequest.findFirstOrThrow({
      where: { requesterUserId: studentUser.id, type: 'correction' },
    })
    expect(routed.officialCorrectionRequestId).toBeTruthy()
    expect(
      (await database.student.findUniqueOrThrow({ where: { id: studentId } }))
        .givenName,
    ).toBe('Hana')
    expect(
      (
        await database.studentCorrectionRequest.findUniqueOrThrow({
          where: { id: routed.officialCorrectionRequestId! },
        })
      ).status,
    ).toBe('pending')
    await page.getByRole('button', { name: 'Correction review' }).click()
    await page
      .getByLabel('Correction review queue')
      .getByRole('button', { name: 'Approve' })
      .click()
    await expect
      .poll(
        async () =>
          (
            await database.student.findUniqueOrThrow({
              where: { id: studentId },
            })
          ).givenName,
      )
      .toBe('Hanna')
    expect(
      (
        await database.studentCorrectionRequest.findUniqueOrThrow({
          where: { id: routed.officialCorrectionRequestId! },
        })
      ).status,
    ).toBe('approved')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await signIn(studentEmail)
    await expect(page.getByLabel('My data requests')).toContainText(
      `Official correction request ${routed.officialCorrectionRequestId}`,
    )
  } finally {
    if (schoolId) {
      await database.auditEvent.deleteMany({ where: { schoolId } })
      await database.notification.deleteMany({
        where: { userId: { in: users } },
      })
      await database.privacyRequest.deleteMany({ where: { schoolId } })
      await database.studentCorrectionRequest.deleteMany({
        where: { schoolId },
      })
      await database.studentAccess.deleteMany({ where: { studentId } })
      await database.enrollment.deleteMany({ where: { schoolId } })
      await database.gradeLevel.deleteMany({ where: { schoolId } })
      await database.academicYear.deleteMany({ where: { schoolId } })
      await database.schoolMembership.deleteMany({ where: { schoolId } })
      if (studentId) await database.student.delete({ where: { id: studentId } })
      await database.session.deleteMany({ where: { userId: { in: users } } })
      await database.passwordCredential.deleteMany({
        where: { userId: { in: users } },
      })
      await database.user.deleteMany({ where: { id: { in: users } } })
      await database.school.delete({ where: { id: schoolId } })
    }
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
