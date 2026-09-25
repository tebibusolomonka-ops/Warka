import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('guardian portal and school office conversation', async ({ page }) => {
  test.setTimeout(150_000)
  const suffix = randomUUID()
  const currentYear = new Date().getUTCFullYear()
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const staffEmail = `family-staff-${suffix}@example.test`
  const parentEmail = `family-parent-${suffix}@example.test`
  const staffPassword = 'StaffPassphrase123!'
  const initialPassword = 'InitialPassphrase123!'
  const newPassword = 'ChangedPassphrase123!'
  let organizationId = ''
  let schoolId = ''
  let staffId = ''
  let parentUserId = ''
  let studentId = ''
  let guardianId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Family Browser ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: 'Family Browser School' },
    })
    schoolId = school.id
    const staff = await database.user.create({
      data: {
        email: staffEmail,
        displayName: 'Browser School Administrator',
        passwordCredential: {
          create: { passwordHash: await hashPassword(staffPassword) },
        },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    staffId = staff.id
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Family Year',
        startsOn: new Date(Date.UTC(currentYear, 0, 1)),
        endsOn: new Date(Date.UTC(currentYear, 11, 31)),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Family Grade' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Family Class',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Family Mathematics' },
    })
    const period = await database.gradingPeriod.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: 'Family Term',
        startsOn: new Date(Date.UTC(currentYear, 0, 1)),
        endsOn: new Date(Date.UTC(currentYear, 11, 31)),
      },
    })
    const student = await database.student.create({
      data: {
        studentReference: `FAMILY-${suffix}`,
        givenName: 'Guardian',
        familyName: 'Child',
      },
    })
    studentId = student.id
    const guardian = await database.guardian.create({
      data: { name: 'Browser Guardian' },
    })
    guardianId = guardian.id
    await database.studentGuardian.create({
      data: { studentId, guardianId, relationship: 'Parent' },
    })
    const enrollment = await database.enrollment.create({
      data: {
        studentId,
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: staffId,
      },
    })
    const resultSet = await database.resultSet.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        status: 'published',
        publishedAt: new Date(),
        publishedById: staffId,
      },
    })
    await database.publishedResult.create({
      data: {
        schoolId,
        resultSetId: resultSet.id,
        studentId,
        enrollmentId: enrollment.id,
        percentage: 86,
        gradeLabel: 'B',
        currentPercentage: 86,
        currentGradeLabel: 'B',
      },
    })
    await database.learningMaterial.create({
      data: {
        schoolId,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        title: 'Family Algebra Guide',
        resourceType: 'link',
        resourceLocation: 'https://example.test/family-algebra',
        publishedAt: new Date(),
        createdById: staffId,
      },
    })
    await database.announcement.create({
      data: {
        schoolId,
        title: 'Family Assembly',
        body: 'Meet in the hall.',
        publishedAt: new Date(),
        createdById: staffId,
      },
    })

    await page.goto('/')
    await page.getByLabel('Email').fill(staffEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page.getByRole('button', { name: 'Enable parent portal' }).click()
    await expect(page.getByText('Parent portal enabled.')).toBeVisible()
    await page
      .locator('section[aria-labelledby="students-heading"]')
      .getByRole('button', { name: /Guardian Child/ })
      .click()
    await page
      .getByRole('button', { name: 'Verify relationship for Browser Guardian' })
      .click()
    await expect(
      page.getByText('Browser Guardian relationship verified.'),
    ).toBeVisible()
    await page
      .getByRole('button', {
        name: 'Provision portal account for Browser Guardian',
      })
      .click()
    await page.getByLabel('Guardian account email').fill(parentEmail)
    await page.getByLabel('Guardian display name').fill('Browser Guardian')
    await page.getByLabel('Guardian initial password').fill(initialPassword)
    await page.getByRole('button', { name: 'Create guardian account' }).click()
    await expect(
      page.getByText(/Browser Guardian account created/),
    ).toBeVisible()
    const linked = await database.guardianAccess.findUnique({
      where: { guardianId },
    })
    expect(linked).not.toBeNull()
    parentUserId = linked!.userId

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)
    await page.getByLabel('Email').fill(parentEmail)
    await page.getByLabel('Password', { exact: true }).fill(initialPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'Change your password' }),
    ).toBeVisible()
    await page.getByLabel('Current password').fill(initialPassword)
    await page.getByLabel('New password', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirm new password').fill(newPassword)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(
      page.getByRole('heading', { name: 'Parent portal' }),
    ).toBeVisible()
    await expect(page.getByText(student.studentReference)).toBeVisible()
    expect(
      (
        await page.request.get(
          `/api/parent/children/UNRELATED-${suffix}/results`,
        )
      ).status(),
    ).toBe(404)
    expect(
      (await page.request.get(`/api/schools/${schoolId}/students`)).status(),
    ).toBe(404)
    await page.getByRole('button', { name: 'Results' }).click()
    await expect(page.getByText(/Family Mathematics: 86%/)).toBeVisible()
    await page.getByRole('button', { name: 'Materials' }).click()
    await expect(page.getByText('Family Algebra Guide')).toBeVisible()
    await page.getByRole('button', { name: 'Announcements' }).click()
    await expect(page.getByText('Family Assembly')).toBeVisible()
    await page.getByRole('button', { name: 'Messages' }).click()
    await page
      .getByLabel('Message', { exact: true })
      .fill('Please confirm the school record.')
    await page.getByRole('button', { name: 'Start conversation' }).click()
    await expect(page.getByText('Conversation started.')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)

    await page.getByLabel('Email').fill(staffEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page
      .getByRole('button', { name: /Guardian Child - School office - open/ })
      .click()
    await page.getByLabel('Staff reply').fill('The record is confirmed.')
    await page.getByRole('button', { name: 'Send reply' }).click()
    await expect(page.getByText('Reply sent.')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)

    await page.getByLabel('Email').fill(parentEmail)
    await page.getByLabel('Password', { exact: true }).fill(newPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('button', { name: 'Messages' }).click()
    await page.getByRole('button', { name: /School office - open/ }).click()
    await expect(
      page.getByText('The record is confirmed.').last(),
    ).toBeVisible()
  } finally {
    if (schoolId) {
      const provisionedParent = await database.user.findUnique({
        where: { email: parentEmail },
      })
      const cleanupUserIds = [
        staffId,
        parentUserId,
        provisionedParent?.id,
      ].filter((value): value is string => !!value)
      await database.familyMessage.deleteMany({
        where: { conversation: { schoolId } },
      })
      await database.familyConversation.deleteMany({ where: { schoolId } })
      await database.schoolServiceAccess.deleteMany({ where: { schoolId } })
      await database.guardianAccess.deleteMany({ where: { guardianId } })
      await database.studentGuardian.deleteMany({ where: { studentId } })
      await database.publishedResult.deleteMany({ where: { schoolId } })
      await database.resultSet.deleteMany({ where: { schoolId } })
      await database.learningMaterial.deleteMany({ where: { schoolId } })
      await database.announcement.deleteMany({ where: { schoolId } })
      await database.enrollment.deleteMany({ where: { schoolId } })
      await database.gradingPeriod.deleteMany({ where: { schoolId } })
      await database.schoolClass.deleteMany({ where: { schoolId } })
      await database.subject.deleteMany({ where: { schoolId } })
      await database.gradeLevel.deleteMany({ where: { schoolId } })
      await database.academicYear.deleteMany({ where: { schoolId } })
      await database.schoolMembership.deleteMany({ where: { schoolId } })
      await database.session.deleteMany({
        where: { userId: { in: cleanupUserIds } },
      })
      await database.passwordCredential.deleteMany({
        where: { userId: { in: cleanupUserIds } },
      })
      await database.user.deleteMany({
        where: { id: { in: cleanupUserIds } },
      })
      await database.guardian.deleteMany({ where: { id: guardianId } })
      await database.student.deleteMany({ where: { id: studentId } })
      await database.school.deleteMany({ where: { id: schoolId } })
    }
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
