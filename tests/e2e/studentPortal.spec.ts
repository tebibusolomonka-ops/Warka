import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('staff provisions student portal access with official records', async ({
  page,
}) => {
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const schoolName = 'Browser School ' + suffix
  const staffEmail = 'staff-' + suffix + '@example.test'
  const studentEmail = 'student-' + suffix + '@example.test'
  const staffPassword = 'StaffPassphrase123!'
  const initialPassword = 'InitialPassphrase123!'
  const newPassword = 'ChangedPassphrase123!'
  let schoolId = ''
  let studentId = ''
  let staffId = ''
  let studentUserId = ''
  let organizationId = ''
  try {
    const organization = await database.organization.create({
      data: { name: 'Browser Organization ' + suffix },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: schoolName },
    })
    schoolId = school.id
    const staff = await database.user.create({
      data: {
        email: staffEmail,
        displayName: 'Browser Registrar',
        passwordCredential: {
          create: { passwordHash: await hashPassword(staffPassword) },
        },
        schoolMemberships: {
          create: { schoolId, role: 'administrator' },
        },
      },
    })
    staffId = staff.id
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Browser Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Browser Grade' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Browser Class',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Browser Mathematics' },
    })
    const period = await database.gradingPeriod.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: 'Browser Term',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-06-30'),
      },
    })
    const student = await database.student.create({
      data: {
        studentReference: 'BROWSER-' + suffix,
        givenName: 'Browser',
        familyName: 'Learner',
      },
    })
    studentId = student.id
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
        percentage: 82,
        gradeLabel: 'B',
        currentPercentage: 82,
        currentGradeLabel: 'B',
      },
    })
    await database.learningMaterial.create({
      data: {
        schoolId,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        title: 'Browser Algebra Guide',
        resourceType: 'link',
        resourceLocation: 'https://example.test/algebra',
        publishedAt: new Date(),
        createdById: staffId,
      },
    })
    await database.announcement.create({
      data: {
        schoolId,
        title: 'Browser Assembly',
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
    await page.getByRole('button', { name: /Browser Learner/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Portal access' }),
    ).toBeVisible()
    await page.getByLabel('Account email').fill(studentEmail)
    await page.getByLabel('Display name').fill('Browser Learner')
    await page.getByLabel('Initial password').fill(initialPassword)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Student account created.')).toBeVisible()
    const linked = await database.studentAccess.findUnique({
      where: { studentId },
    })
    expect(linked).not.toBeNull()
    studentUserId = linked!.userId
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByLabel('Email').fill(studentEmail)
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
      page.getByRole('heading', { name: 'Student portal' }),
    ).toBeVisible()
    await expect(page.getByText('BROWSER-' + suffix)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Staff workspace' }),
    ).toHaveCount(0)
    const adminResponse = await page.request.get(
      '/api/schools/' + schoolId + '/students',
    )
    expect(adminResponse.status()).toBe(404)
    await page.getByRole('button', { name: 'Results' }).click()
    await expect(page.getByText(/Browser Mathematics: 82%/)).toBeVisible()
    await page.getByRole('button', { name: 'Materials' }).click()
    await expect(page.getByText('Browser Algebra Guide')).toBeVisible()
    await page.getByRole('button', { name: 'Announcements' }).click()
    await expect(page.getByText('Browser Assembly')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  } finally {
    if (studentUserId) {
      await database.session.deleteMany({ where: { userId: studentUserId } })
      await database.studentAccess.deleteMany({
        where: { userId: studentUserId },
      })
      await database.passwordCredential.deleteMany({
        where: { userId: studentUserId },
      })
      await database.user.delete({ where: { id: studentUserId } })
    }
    if (schoolId) {
      await database.session.deleteMany({ where: { userId: staffId } })
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
      await database.passwordCredential.deleteMany({
        where: { userId: staffId },
      })
      await database.user.delete({ where: { id: staffId } })
      await database.school.delete({ where: { id: schoolId } })
    }
    if (studentId) await database.student.delete({ where: { id: studentId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
