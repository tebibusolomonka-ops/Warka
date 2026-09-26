import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('administrator promotes a student while retaining the source enrollment', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'RolloverPassphrase123!'
  const email = `rollover-admin-${suffix}@example.test`
  let organizationId = '',
    schoolId = '',
    studentId = '',
    staffId = '',
    sourceYearId = '',
    targetYearId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Rollover Organization ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: `Rollover School ${suffix}` },
    })
    schoolId = school.id
    const staff = await database.user.create({
      data: {
        email,
        displayName: 'Rollover Administrator',
        passwordCredential: {
          create: { passwordHash: await hashPassword(password) },
        },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    staffId = staff.id
    const sourceYear = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Rollover Source',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    sourceYearId = sourceYear.id
    const targetYear = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Rollover Target',
        startsOn: new Date('2027-01-01'),
        endsOn: new Date('2027-12-31'),
      },
    })
    targetYearId = targetYear.id
    const sourceGrade = await database.gradeLevel.create({
      data: { schoolId, name: 'Rollover Grade 1' },
    })
    const targetGrade = await database.gradeLevel.create({
      data: { schoolId, name: 'Rollover Grade 2' },
    })
    await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: targetYearId,
        gradeLevelId: targetGrade.id,
        name: 'Rollover Class 2A',
      },
    })
    const student = await database.student.create({
      data: {
        studentReference: `ROL-${suffix}`,
        givenName: 'Rollover',
        familyName: 'Student',
      },
    })
    studentId = student.id
    const sourceEnrollment = await database.enrollment.create({
      data: {
        schoolId,
        studentId,
        academicYearId: sourceYearId,
        gradeLevelId: sourceGrade.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: staffId,
      },
    })
    await page.goto('/')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    const rollover = page.getByRole('region', { name: 'Year rollover' })
    await rollover.getByRole('button', { name: 'Year rollover' }).click()
    await rollover.getByLabel('Source academic year').selectOption(sourceYearId)
    await rollover.getByLabel('Target academic year').selectOption(targetYearId)
    await rollover
      .getByRole('button', { name: 'Create progression plan' })
      .click()
    await expect(
      rollover.getByLabel(`Select ${student.studentReference}`),
    ).toBeVisible()
    await rollover.getByRole('button', { name: 'Validate and preview' }).click()
    await expect(
      rollover.getByText(/Manual review: 1; Blocking errors: 1/),
    ).toBeVisible()
    await expect(
      rollover.getByRole('button', { name: 'Confirm review' }),
    ).toBeDisabled()
    await rollover.getByLabel('Source grade').selectOption(sourceGrade.id)
    await rollover.getByLabel('Target grade').selectOption(targetGrade.id)
    await rollover.getByRole('button', { name: 'Prepare promotions' }).click()
    await expect(rollover.getByText('Promotions prepared')).toBeVisible()
    await rollover.getByRole('button', { name: 'Validate and preview' }).click()
    await expect(
      rollover.getByText(
        /Promote: 1; Repeat: 0; Withdraw: 0; Manual review: 0; Blocking errors: 0/,
      ),
    ).toBeVisible()
    await rollover
      .getByLabel('Resolution note')
      .fill('Promotion destination reviewed')
    await rollover
      .getByRole('button', { name: 'Resolve after correction' })
      .click()
    await expect(rollover.getByText('Exception resolved')).toBeVisible()
    await rollover.getByLabel('I reviewed every progression decision').check()
    await rollover.getByRole('button', { name: 'Confirm review' }).click()
    await rollover.getByRole('button', { name: 'Apply rollover' }).click()
    await expect(
      rollover.getByText(/1 source-year enrollment records preserved/),
    ).toBeVisible()
    const enrollments = await database.enrollment.findMany({
      where: { schoolId, studentId },
      orderBy: { createdAt: 'asc' },
    })
    expect(enrollments).toHaveLength(2)
    expect(enrollments.map((item) => item.academicYearId).sort()).toEqual(
      [sourceYearId, targetYearId].sort(),
    )
    expect(
      enrollments.find((item) => item.id === sourceEnrollment.id)?.status,
    ).toBe('approved')
    await page
      .getByRole('button', {
        name: `Rollover Student · ${student.studentReference}`,
      })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Rollover Student' }),
    ).toBeVisible()
    await expect(page.locator('.enrollment')).toHaveCount(2)
  } finally {
    if (schoolId) {
      await database.session.deleteMany({ where: { userId: staffId } })
      await database.auditEvent.deleteMany({ where: { schoolId } })
      await database.enrollmentHistoryEvent.deleteMany({
        where: { enrollment: { schoolId } },
      })
      await database.progressionException.deleteMany({
        where: { plan: { schoolId } },
      })
      await database.progressionEntry.deleteMany({
        where: { plan: { schoolId } },
      })
      await database.progressionPlan.deleteMany({ where: { schoolId } })
      await database.enrollment.deleteMany({ where: { schoolId } })
      await database.schoolClass.deleteMany({ where: { schoolId } })
      await database.gradeLevel.deleteMany({ where: { schoolId } })
      await database.academicYear.deleteMany({ where: { schoolId } })
      await database.schoolMembership.deleteMany({ where: { schoolId } })
      await database.passwordCredential.deleteMany({
        where: { userId: staffId },
      })
      await database.user.deleteMany({ where: { id: staffId } })
      await database.school.delete({ where: { id: schoolId } })
    }
    if (studentId) await database.student.delete({ where: { id: studentId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
