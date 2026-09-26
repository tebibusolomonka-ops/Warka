import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('school administrator imports synthetic registrations and downloads an audited roster', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'OperationsPassphrase123!'
  const administratorEmail = `operations-admin-${suffix}@example.test`
  const teacherEmail = `operations-teacher-${suffix}@example.test`
  const userIds: string[] = []
  let organizationId = ''
  let schoolId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Operations Organization ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: `Operations School ${suffix}` },
    })
    schoolId = school.id
    const passwordHash = await hashPassword(password)
    const administrator = await database.user.create({
      data: {
        email: administratorEmail,
        displayName: 'Operations Administrator',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Operations Teacher',
        passwordCredential: { create: { passwordHash } },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    userIds.push(administrator.id, teacher.id)
    const currentYear = new Date().getUTCFullYear()
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Operations Year',
        startsOn: new Date(Date.UTC(currentYear, 0, 1)),
        endsOn: new Date(Date.UTC(currentYear, 11, 31)),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Operations Grade' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Operations Class',
      },
    })
    const csv = [
      'givenName,familyName,academicYearId,gradeLevelId,schoolClassId',
      `Synthetic,Import${suffix.slice(0, 6)},${year.id},${grade.id},${schoolClass.id}`,
    ].join('\n')
    await page.goto('/')
    await page.getByLabel('Email').fill(administratorEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page.getByRole('button', { name: 'School operations' }).click()
    await page.getByLabel('Student registration CSV').setInputFiles({
      name: 'synthetic-registration.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await page.getByRole('button', { name: 'Upload and validate' }).click()
    await expect(page.getByText(/Status: validated/)).toBeVisible()
    await page.getByRole('button', { name: 'Apply import' }).click()
    await expect(
      page.getByText('1 student registrations applied as draft enrollments.'),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Synthetic Import/ }),
    ).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export student roster' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('studentRoster.csv')
    await page.getByRole('button', { name: /Notifications/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Notifications' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email').fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'School operations' }),
    ).toHaveCount(0)
    expect(
      await database.auditEvent.count({
        where: { schoolId, action: 'schoolData.exported' },
      }),
    ).toBe(1)
  } finally {
    if (schoolId) {
      await database.importJob.deleteMany({ where: { schoolId } })
      const enrollments = await database.enrollment.findMany({
        where: { schoolId },
        select: { studentId: true },
      })
      await database.enrollment.deleteMany({ where: { schoolId } })
      await database.student.deleteMany({
        where: { id: { in: enrollments.map((item) => item.studentId) } },
      })
      await database.schoolClass.deleteMany({ where: { schoolId } })
      await database.gradeLevel.deleteMany({ where: { schoolId } })
      await database.academicYear.deleteMany({ where: { schoolId } })
      await database.schoolMembership.deleteMany({ where: { schoolId } })
      await database.session.deleteMany({ where: { userId: { in: userIds } } })
      await database.passwordCredential.deleteMany({
        where: { userId: { in: userIds } },
      })
      await database.user.deleteMany({ where: { id: { in: userIds } } })
      await database.auditEvent.deleteMany({ where: { schoolId } })
      await database.school.delete({ where: { id: schoolId } })
    }
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
