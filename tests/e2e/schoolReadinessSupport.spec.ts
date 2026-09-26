import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('school onboarding and scoped support resolution', async ({ page }) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'ReadinessPassphrase123!'
  const adminEmail = `readiness-admin-${suffix}@example.test`
  const supportEmail = `readiness-support-${suffix}@example.test`
  let organizationId = '',
    schoolId = '',
    otherSchoolId = '',
    adminId = '',
    teacherId = '',
    supportId = '',
    otherAdminId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Readiness Org ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: `Readiness School ${suffix}` },
    })
    schoolId = school.id
    const otherSchool = await database.school.create({
      data: { organizationId, name: `Other Readiness School ${suffix}` },
    })
    otherSchoolId = otherSchool.id
    const hash = await hashPassword(password)
    const admin = await database.user.create({
      data: {
        email: adminEmail,
        displayName: 'Readiness Administrator',
        passwordCredential: { create: { passwordHash: hash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    adminId = admin.id
    const teacher = await database.user.create({
      data: {
        email: `readiness-teacher-${suffix}@example.test`,
        displayName: 'Readiness Teacher',
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    teacherId = teacher.id
    const support = await database.user.create({
      data: {
        email: supportEmail,
        displayName: 'Readiness Support',
        passwordCredential: { create: { passwordHash: hash } },
        supportIdentity: { create: {} },
      },
    })
    supportId = support.id
    const otherAdmin = await database.user.create({
      data: {
        email: `readiness-other-${suffix}@example.test`,
        displayName: 'Other Administrator',
        schoolMemberships: {
          create: { schoolId: otherSchoolId, role: 'administrator' },
        },
      },
    })
    otherAdminId = otherAdmin.id
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Readiness Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Readiness Grade' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Readiness Class',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Readiness Subject' },
    })
    await database.gradingScheme.create({ data: { schoolId } })
    await database.schoolDocumentProfile.create({
      data: { schoolId, officialName: 'Readiness School' },
    })
    await database.teachingAssignment.create({
      data: {
        schoolId,
        userId: teacherId,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
      },
    })
    await database.supportAccessGrant.create({
      data: {
        supportUserId: supportId,
        schoolId,
        reason: 'Onboarding support case',
        requestedById: adminId,
        approvedById: adminId,
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        status: 'approved',
      },
    })
    const unrelated = await database.supportRequest.create({
      data: {
        schoolId: otherSchoolId,
        createdById: otherAdminId,
        category: 'technical',
        severity: 'normal',
        title: 'Unrelated case',
        description: 'This case belongs to another school.',
      },
    })
    const signIn = async (email: string) => {
      await page.goto('/')
      await page.getByLabel('Email', { exact: true }).fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    }
    await signIn(adminEmail)
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    const onboarding = page.getByRole('region', { name: 'School onboarding' })
    await onboarding.getByRole('button', { name: 'School onboarding' }).click()
    await expect(
      onboarding.getByText('Current readiness: warning'),
    ).toBeVisible()
    await onboarding.getByRole('button', { name: 'Start onboarding' }).click()
    await expect(
      onboarding.getByText('Onboarding status: inProgress'),
    ).toBeVisible()
    await onboarding.getByLabel('Contact name').fill('Primary Records Officer')
    await onboarding.getByLabel('Contact email').fill('records@example.test')
    await onboarding.getByRole('button', { name: 'Save contact' }).click()
    await expect(onboarding.getByText('Primary Records Officer')).toBeVisible()
    await onboarding
      .getByLabel('Set backupContactConfirmed')
      .selectOption('complete')
    await onboarding
      .getByLabel('Set staffOrientationConfirmed')
      .selectOption('complete')
    await onboarding.getByLabel('Staff user ID').fill(teacherId)
    await onboarding
      .getByLabel('Training type')
      .selectOption('studentRegistration')
    await onboarding.getByRole('button', { name: 'Assign training' }).click()
    await expect(
      onboarding.getByText(/Readiness Teacher.*studentRegistration.*assigned/),
    ).toBeVisible()
    await onboarding.getByRole('button', { name: 'Complete training' }).click()
    await expect(
      onboarding.getByText(/Readiness Teacher.*studentRegistration.*completed/),
    ).toBeVisible()
    await onboarding
      .getByRole('button', { name: 'Submit onboarding for review' })
      .click()
    await expect(
      onboarding.getByText('Onboarding status: readyForReview'),
    ).toBeVisible()
    await onboarding
      .getByRole('button', { name: 'Complete onboarding' })
      .click()
    await expect(
      onboarding.getByText('Onboarding status: completed'),
    ).toBeVisible()
    const schoolSupport = page.getByRole('region', { name: 'School support' })
    await schoolSupport.getByRole('button', { name: 'School support' }).click()
    await schoolSupport.getByLabel('Title').fill('Cannot load school dashboard')
    await schoolSupport
      .getByLabel('Description')
      .fill('The dashboard shows an unexpected error after sign in.')
    await schoolSupport
      .getByRole('button', { name: 'Create support request' })
      .click()
    await expect(
      schoolSupport.getByText('Support request created'),
    ).toBeVisible()
    const request = await database.supportRequest.findFirstOrThrow({
      where: { schoolId, title: 'Cannot load school dashboard' },
    })
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(supportEmail)
    const supportView = page.getByRole('region', { name: 'Warka support' })
    await supportView.getByRole('button', { name: 'Warka support' }).click()
    await expect(
      supportView.getByRole('button', { name: /Cannot load school dashboard/ }),
    ).toBeVisible()
    const denied = await page.request.get(
      `/api/schools/${otherSchoolId}/support-requests/${unrelated.id}`,
    )
    expect(denied.status()).toBe(404)
    await supportView
      .getByRole('button', { name: /Cannot load school dashboard/ })
      .click()
    await supportView
      .getByLabel('Response')
      .fill('We identified and corrected the configuration issue.')
    await supportView.getByRole('button', { name: 'Send response' }).click()
    await supportView
      .getByLabel('Resolution summary')
      .fill('The school dashboard configuration was corrected.')
    await supportView.getByRole('button', { name: 'Resolve request' }).click()
    await expect(supportView.getByText('Request resolved')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signIn(adminEmail)
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    const refreshedSupport = page.getByRole('region', {
      name: 'School support',
    })
    await refreshedSupport
      .getByRole('button', { name: 'School support' })
      .click()
    await refreshedSupport
      .getByRole('button', { name: /Cannot load school dashboard/ })
      .click()
    await expect(
      refreshedSupport.getByText(
        'Resolution: The school dashboard configuration was corrected.',
      ),
    ).toBeVisible()
    await refreshedSupport
      .getByRole('button', { name: 'Close resolved request' })
      .click()
    await expect(refreshedSupport.getByText('Request closed')).toBeVisible()
    expect(
      (
        await database.supportRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).status,
    ).toBe('closed')
  } finally {
    await database.notification.deleteMany({
      where: { userId: { in: [adminId, supportId, teacherId, otherAdminId] } },
    })
    await database.auditEvent.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    })
    await database.session.deleteMany({
      where: { userId: { in: [adminId, supportId, teacherId, otherAdminId] } },
    })
    await database.supportRequestMessage.deleteMany({
      where: { request: { schoolId: { in: [schoolId, otherSchoolId] } } },
    })
    await database.supportRequest.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    })
    await database.supportAccessGrant.deleteMany({ where: { schoolId } })
    await database.trainingRecord.deleteMany({ where: { schoolId } })
    await database.onboardingChecklistItem.deleteMany({
      where: { onboarding: { schoolId } },
    })
    await database.schoolOnboarding.deleteMany({ where: { schoolId } })
    await database.schoolContact.deleteMany({ where: { schoolId } })
    await database.teachingAssignment.deleteMany({ where: { schoolId } })
    await database.gradingScheme.deleteMany({ where: { schoolId } })
    await database.schoolDocumentProfile.deleteMany({ where: { schoolId } })
    await database.schoolClass.deleteMany({ where: { schoolId } })
    await database.subject.deleteMany({ where: { schoolId } })
    await database.gradeLevel.deleteMany({ where: { schoolId } })
    await database.academicYear.deleteMany({ where: { schoolId } })
    await database.user.deleteMany({
      where: { id: { in: [adminId, supportId, teacherId, otherAdminId] } },
    })
    await database.school.deleteMany({
      where: { id: { in: [schoolId, otherSchoolId] } },
    })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
